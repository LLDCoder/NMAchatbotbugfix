
import CryptoJS from 'crypto-js';

export default function aesEncrypt(plaintext: string) {
  const key = CryptoJS.enc.Utf8.parse('rRgORced0ZjzOhgiciT2oonGfO2DbZ7Z');
  const iv = CryptoJS.enc.Utf8.parse('IT3tqtrHxunSiS5b');
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

export function aesDecrypt(ciphertext: string): string {
  const key = CryptoJS.enc.Utf8.parse('rRgORced0ZjzOhgiciT2oonGfO2DbZ7Z');
  const iv = CryptoJS.enc.Utf8.parse('IT3tqtrHxunSiS5b');
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}