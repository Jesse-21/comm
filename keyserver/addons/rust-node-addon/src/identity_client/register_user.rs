use super::*;

#[napi]
#[instrument(skip_all)]
pub async fn register_user(
  user_id: String,
  signing_public_key: String,
  username: String,
  password: String,
  session_initialization_info: HashMap<String, String>,
) -> Result<String> {
  let channel = get_identity_service_channel().await?;
  let token: MetadataValue<_> = IDENTITY_SERVICE_CONFIG
    .identity_auth_token
    .parse()
    .map_err(|_| Error::from_status(Status::GenericFailure))?;
  let mut identity_client =
    IdentityServiceClient::with_interceptor(channel, |mut req: Request<()>| {
      req.metadata_mut().insert("authorization", token.clone());
      Ok(req)
    });

  // Create a RegistrationRequest channel and use ReceiverStream to turn the
  // MPSC receiver into a Stream for outbound messages
  let (tx, rx) = mpsc::channel(1);
  let stream = ReceiverStream::new(rx);
  let request = Request::new(stream);

  // `response` is the Stream for inbound messages
  let mut response = identity_client
    .register_user(request)
    .await
    .map_err(|_| Error::from_status(Status::GenericFailure))?
    .into_inner();

  // Start PAKE registration on client and send initial registration request
  // to Identity service
  let mut client_rng = OsRng;
  let (registration_request, client_registration) = pake_registration_start(
    &mut client_rng,
    user_id,
    signing_public_key,
    &password,
    username,
    SessionInitializationInfo {
      info: session_initialization_info,
    },
  )?;
  send_to_mpsc(tx.clone(), registration_request).await?;

  // Handle responses from Identity service sequentially, making sure we get
  // messages in the correct order

  // Finish PAKE registration and begin PAKE login; send the final
  // registration request and initial login request together to reduce the
  // number of trips
  let message = response
    .message()
    .await
    .map_err(|_| Error::from_status(Status::GenericFailure))?;
  let client_login = handle_registration_response(
    message,
    &mut client_rng,
    client_registration,
    &password,
    tx.clone(),
  )
  .await?;

  // Finish PAKE login; send final login request to Identity service
  let message = response
    .message()
    .await
    .map_err(|_| Error::from_status(Status::GenericFailure))?;
  handle_registration_credential_response(message, client_login, tx)
    .await
    .map_err(|_| Error::from_status(Status::GenericFailure))?;

  // Return access token
  let message = response
    .message()
    .await
    .map_err(|_| Error::from_status(Status::GenericFailure))?;
  handle_registration_token_response(message)
}

async fn handle_registration_response(
  message: Option<RegistrationResponseMessage>,
  client_rng: &mut (impl Rng + CryptoRng),
  client_registration: ClientRegistration<Cipher>,
  password: &str,
  tx: mpsc::Sender<RegistrationRequest>,
) -> Result<ClientLogin<Cipher>> {
  if let Some(RegistrationResponseMessage {
    data: Some(PakeRegistrationResponse(registration_response_bytes)),
    ..
  }) = message
  {
    let pake_registration_upload = pake_registration_finish(
      client_rng,
      &registration_response_bytes,
      client_registration,
    )?
    .serialize();
    let client_login_start_result = pake_login_start(client_rng, password)?;

    // `registration_request` is a gRPC message containing serialized bytes to
    // complete PAKE registration and begin PAKE login
    let registration_request = RegistrationRequest {
      data: Some(PakeRegistrationUploadAndCredentialRequest(
        PakeRegistrationUploadAndCredentialRequestStruct {
          pake_registration_upload,
          pake_credential_request: client_login_start_result
            .message
            .serialize()
            .map_err(|e| {
              error!("Could not serialize credential request: {}", e);
              Error::from_status(Status::GenericFailure)
            })?,
        },
      )),
    };
    send_to_mpsc(tx, registration_request).await?;
    Ok(client_login_start_result.state)
  } else {
    Err(handle_unexpected_response(message))
  }
}

async fn handle_registration_credential_response(
  message: Option<RegistrationResponseMessage>,
  client_login: ClientLogin<Cipher>,
  tx: mpsc::Sender<RegistrationRequest>,
) -> Result<()> {
  if let Some(RegistrationResponseMessage {
    data:
      Some(RegistrationPakeLoginResponse(PakeLoginResponseStruct {
        data: Some(PakeCredentialResponse(credential_response_bytes)),
      })),
  }) = message
  {
    let registration_request = RegistrationRequest {
      data: Some(RegistrationPakeCredentialFinalization(
        pake_login_finish(&credential_response_bytes, client_login)?
          .serialize()
          .map_err(|e| {
            error!("Could not serialize credential request: {}", e);
            Error::from_status(Status::GenericFailure)
          })?,
      )),
    };
    send_to_mpsc(tx, registration_request).await
  } else {
    Err(handle_unexpected_response(message))
  }
}

fn handle_registration_token_response(
  message: Option<RegistrationResponseMessage>,
) -> Result<String> {
  if let Some(RegistrationResponseMessage {
    data:
      Some(RegistrationPakeLoginResponse(PakeLoginResponseStruct {
        data: Some(AccessToken(access_token)),
      })),
  }) = message
  {
    Ok(access_token)
  } else {
    Err(handle_unexpected_response(message))
  }
}

fn pake_registration_start(
  rng: &mut (impl Rng + CryptoRng),
  user_id: String,
  signing_public_key: String,
  password: &str,
  username: String,
  session_initialization_info: SessionInitializationInfo,
) -> Result<(RegistrationRequest, ClientRegistration<Cipher>)> {
  let client_registration_start_result =
    ClientRegistration::<Cipher>::start(rng, password.as_bytes()).map_err(
      |e| {
        error!("Failed to start PAKE registration: {}", e);
        Error::from_status(Status::GenericFailure)
      },
    )?;
  let pake_registration_request =
    client_registration_start_result.message.serialize();
  Ok((
    RegistrationRequest {
      data: Some(PakeRegistrationRequestAndUserId(
        PakeRegistrationRequestAndUserIdStruct {
          user_id,
          pake_registration_request,
          username,
          signing_public_key,
          session_initialization_info: Some(session_initialization_info),
        },
      )),
    },
    client_registration_start_result.state,
  ))
}

fn pake_registration_finish(
  rng: &mut (impl Rng + CryptoRng),
  registration_response_bytes: &[u8],
  client_registration: ClientRegistration<Cipher>,
) -> Result<RegistrationUpload<Cipher>> {
  client_registration
    .finish(
      rng,
      RegistrationResponse::deserialize(registration_response_bytes).map_err(
        |e| {
          error!("Could not deserialize registration response bytes: {}", e);
          Error::from_status(Status::GenericFailure)
        },
      )?,
      ClientRegistrationFinishParameters::default(),
    )
    .map_err(|e| {
      error!("Failed to finish PAKE registration: {}", e);
      Error::from_status(Status::GenericFailure)
    })
    .map(|res| res.message)
}
