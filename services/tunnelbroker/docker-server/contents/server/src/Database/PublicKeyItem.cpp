#include "PublicKeyItem.h"
#include "Constants.h"

namespace comm {
namespace network {
namespace database {

std::string PublicKeyItem::tableName = DEVICE_PUBLIC_KEY_TABLE_NAME;
const std::string PublicKeyItem::FIELD_DEVICE_ID = "DeviceId";
const std::string PublicKeyItem::FIELD_PUBLIC_KEY = "PublicKey";

PublicKeyItem::PublicKeyItem(
    const std::string deviceId,
    const std::string publicKey)
    : deviceId(deviceId), publicKey(publicKey) {
  this->validate();
}

PublicKeyItem::PublicKeyItem(const AttributeValues &itemFromDB) {
  this->assignItemFromDatabase(itemFromDB);
}

void PublicKeyItem::validate() const {
  if (!this->deviceId.size()) {
    throw std::runtime_error("Error: DeviceId is empty");
  }
  if (!this->publicKey.size()) {
    throw std::runtime_error("Error: PublicKey is empty");
  }
}

void PublicKeyItem::assignItemFromDatabase(const AttributeValues &itemFromDB) {
  try {
    this->publicKey = itemFromDB.at(PublicKeyItem::FIELD_PUBLIC_KEY).GetS();
    this->deviceId = itemFromDB.at(PublicKeyItem::FIELD_DEVICE_ID).GetS();
  } catch (const std::exception &e) {
    throw std::runtime_error(
        "Got an exception at PublicKeyItem: " + std::string(e.what()));
  }
  this->validate();
}

std::string PublicKeyItem::getTableName() const {
  return PublicKeyItem::tableName;
}

std::string PublicKeyItem::getPrimaryKey() const {
  return PublicKeyItem::FIELD_DEVICE_ID;
}

std::string PublicKeyItem::getDeviceId() const {
  return this->deviceId;
}

std::string PublicKeyItem::getPublicKey() const {
  return this->publicKey;
}

} // namespace database
} // namespace network
} // namespace comm