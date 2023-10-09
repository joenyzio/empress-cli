const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

exports.generateToken = (userId) => {
  return jwt.sign({ userId }, "yourSecretKey", { expiresIn: "1h" });
};

exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, "yourSecretKey");
  } catch (err) {
    throw new Error("Token is not valid");
  }
};

exports.setup2FA = async () => {
  const secret = speakeasy.generateSecret({ length: 20 });
  const imageUrl = await QRCode.toDataURL(secret.otpauth_url);

  return { secret: secret.base32, imageUrl };
};
