import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';

const String tokenAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

String normalizeHardware(String value) => value.trim().replaceAll(RegExp(r'\s+'), '').toUpperCase();
String normalizeFarmId(String value) => value.trim().replaceAll(RegExp(r'\s+'), '').toUpperCase();

String encodeReadableDigest(List<int> bytes, {int length = 16}) {
  final buffer = StringBuffer();
  int bitBuffer = 0;
  int bitCount = 0;

  for (final byte in bytes) {
    bitBuffer = (bitBuffer << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5 && buffer.length < length) {
      final index = (bitBuffer >> (bitCount - 5)) & 31;
      buffer.write(tokenAlphabet[index]);
      bitCount -= 5;
    }

    if (buffer.length >= length) break;
  }

  return buffer.toString();
}

String groupBy4(String value) {
  final chunks = <String>[];
  for (int i = 0; i < value.length; i += 4) {
    chunks.add(value.substring(i, (i + 4 < value.length) ? i + 4 : value.length));
  }
  return chunks.join('-');
}

String generateIssuedLicenseToken({
  required String hardwareId,
  required String desktopFarmId,
  required DateTime targetExpiryDateUtc,
  required int durationDays,
  required String secret,
}) {
  final normalizedHardware = normalizeHardware(hardwareId);
  final normalizedFarmId = normalizeFarmId(desktopFarmId);
  final expiryIso = targetExpiryDateUtc.toUtc().toIso8601String();

  final payload = 'hatchlog-manual-v1:$normalizedHardware:$normalizedFarmId:$expiryIso';
  final digest = Hmac(sha256, utf8.encode(secret)).convert(utf8.encode(payload)).bytes;
  final body = groupBy4(encodeReadableDigest(digest, length: 16));

  return 'HL-${durationDays}D-$body';
}

bool validateIssuedToken({
  required String token,
  required String hardwareId,
  required String desktopFarmId,
  required DateTime expiryUtc,
  required int durationDays,
  required String secret,
}) {
  final expected = generateIssuedLicenseToken(
    hardwareId: hardwareId,
    desktopFarmId: desktopFarmId,
    targetExpiryDateUtc: expiryUtc,
    durationDays: durationDays,
    secret: secret,
  );

  return token.trim().toUpperCase() == expected.toUpperCase();
}

String buildActivationPackage({required String farmId, required String systemGuid}) {
  final normalizedFarmId = normalizeFarmId(farmId);
  final normalizedHardware = normalizeHardware(systemGuid);
  return 'FARM_ID=$normalizedFarmId\nHARDWARE_ID=$normalizedHardware';
}

Future<void> copyActivationPackage({required String farmId, required String systemGuid}) async {
  final payload = buildActivationPackage(farmId: farmId, systemGuid: systemGuid);
  await Clipboard.setData(ClipboardData(text: payload));
}
