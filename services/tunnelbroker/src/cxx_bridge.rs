#[cxx::bridge]
pub mod ffi {
  unsafe extern "C++" {
    include!("tunnelbroker/src/libcpp/Tunnelbroker.h");
    pub fn initialize();
  }
}
