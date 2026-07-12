import base64
from Crypto.Cipher import AES
from Crypto.Util import Padding

BS = 16
IV = "p3s6v9y$B&E)H@Mc"
key = "p3s6v9y$B&E)H@Mc"


class AesCipher:
    def __init__(self):
        self.iv = IV.encode('utf-8')
        self.key = key.encode("utf-8")

    def decrypt(self, text):
        aes = AES.new(self.key, AES.MODE_CBC, self.iv)
        decoded_value = base64.b64decode(text)
        return Padding.unpad(aes.decrypt(decoded_value), BS, style='pkcs7').decode('utf-8')

    def encrypt(self, text):
        aes = AES.new(self.key, AES.MODE_CBC, self.iv)
        encoded_value = Padding.pad(text.encode('utf-8'), BS, style='pkcs7')
        return base64.b64encode(aes.encrypt(encoded_value)).decode('utf-8')


