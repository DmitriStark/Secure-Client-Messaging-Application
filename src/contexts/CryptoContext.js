import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

export const CryptoContext = createContext();

export const CryptoProvider = ({ children }) => {
  const [keyPair, setKeyPair] = useState(null);
  const [userKeyPairs, setUserKeyPairs] = useState({});
  const [keyVersions, setKeyVersions] = useState({});
  const [serverPublicKey, setServerPublicKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatPEM = (base64, isPrivate = false) => {
    const pemType = isPrivate ? "PRIVATE" : "PUBLIC";
    let formatted = `-----BEGIN ${pemType} KEY-----\n`;

    let remaining = base64;
    while (remaining.length > 0) {
      formatted += remaining.substring(0, 64) + "\n";
      remaining = remaining.substring(64);
    }

    formatted += `-----END ${pemType} KEY-----`;
    return formatted;
  };

  useEffect(() => {
    const loadAllKeyPairs = () => {
      try {
        const storedKeyPairsStr = localStorage.getItem("userKeyPairs");
        if (storedKeyPairsStr) {
          const storedKeyPairs = JSON.parse(storedKeyPairsStr);
          setUserKeyPairs(storedKeyPairs);
          console.log(
            `Loaded key pairs for ${Object.keys(storedKeyPairs).length} users`
          );
        } else {
          setUserKeyPairs({});
        }

        const storedKeyVersionsStr = localStorage.getItem("keyVersions");
        if (storedKeyVersionsStr) {
          const storedKeyVersions = JSON.parse(storedKeyVersionsStr);
          setKeyVersions(storedKeyVersions);
          console.log(
            `Loaded ${Object.keys(storedKeyVersions).length} key versions`
          );
        } else {
          setKeyVersions({});
        }
      } catch (err) {
        console.error("Error loading stored keys:", err);
        setUserKeyPairs({});
        setKeyVersions({});
      }
    };

    loadAllKeyPairs();
  }, []);

  useEffect(() => {
    const generateKeyPair = async () => {
      try {
        const storedKeyPair = localStorage.getItem("keyPair");

        if (storedKeyPair) {
          const parsedKeyPair = JSON.parse(storedKeyPair);

          if (
            parsedKeyPair.publicKey.includes("BEGIN PUBLIC KEY") &&
            parsedKeyPair.publicKey.includes("END PUBLIC KEY") &&
            parsedKeyPair.privateKey.includes("BEGIN PRIVATE KEY") &&
            parsedKeyPair.privateKey.includes("END PRIVATE KEY")
          ) {
            console.log("Using stored key pair with proper PEM format");
            setKeyPair(parsedKeyPair);
          } else {
            console.log(
              "Stored key pair doesn't have proper PEM format, generating new keys"
            );
            await generateNewKeyPair();
          }
        } else {
          console.log("No stored key pair found, generating new keys");
          await generateNewKeyPair();
        }
      } catch (err) {
        console.error("Error generating key pair:", err);
        setError("Failed to generate encryption keys");
      }
    };

    generateKeyPair();
    //TODO MAKE WORK WITHOUT WARNING
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); //had disable here due no time

  const generateNewKeyPair = async (username) => {
    try {
      const cryptoKeyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      const publicKeyBuffer = await window.crypto.subtle.exportKey(
        "spki",
        cryptoKeyPair.publicKey
      );
      const privateKeyBuffer = await window.crypto.subtle.exportKey(
        "pkcs8",
        cryptoKeyPair.privateKey
      );

      const publicKeyBase64 = btoa(
        String.fromCharCode(...new Uint8Array(publicKeyBuffer))
      );
      const privateKeyBase64 = btoa(
        String.fromCharCode(...new Uint8Array(privateKeyBuffer))
      );

      const formattedPublicKey = formatPEM(publicKeyBase64, false);
      const formattedPrivateKey = formatPEM(privateKeyBase64, true);

      const timestamp = Date.now();
      const versionId = username
        ? `${username}-${timestamp}`
        : `default-${timestamp}`;

      const newKeyPair = {
        publicKey: formattedPublicKey,
        privateKey: formattedPrivateKey,
        createdAt: new Date().toISOString(),
        versionId: versionId,
      };

      console.log(
        "Public key has correct format:",
        newKeyPair.publicKey.includes("BEGIN PUBLIC KEY") &&
          newKeyPair.publicKey.includes("END PUBLIC KEY")
      );

      if (username) {
        const updatedKeyVersions = {
          ...keyVersions,
          [versionId]: {
            publicKey: formattedPublicKey,
            privateKey: formattedPrivateKey,
            createdAt: new Date().toISOString(),
            username: username,
          },
        };
        setKeyVersions(updatedKeyVersions);
        localStorage.setItem("keyVersions", JSON.stringify(updatedKeyVersions));

        const updatedKeyPairs = {
          ...userKeyPairs,
          [username]: newKeyPair,
        };
        setUserKeyPairs(updatedKeyPairs);
        localStorage.setItem("userKeyPairs", JSON.stringify(updatedKeyPairs));
      }

      setKeyPair(newKeyPair);
      localStorage.setItem("keyPair", JSON.stringify(newKeyPair));
      console.log("New key pair generated and stored successfully");

      return newKeyPair;
    } catch (err) {
      console.error("Error generating new key pair:", err);
      throw err;
    }
  };

  const getUserKeyVersions = (username) => {
    if (!username) return [];

    return Object.entries(keyVersions)
      .filter(([_, keyData]) => keyData.username === username)
      .map(([versionId, keyData]) => ({
        versionId,
        createdAt: keyData.createdAt,
        publicKey: keyData.publicKey,
        isImported: keyData.isImported || false,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const tryDecryptWithAllKeys = async (encryptedData, keyCollection) => {
    if (!encryptedData) return null;

    const keysToTry = keyCollection || keyVersions;

    for (const [versionId, keyData] of Object.entries(keysToTry)) {
      try {
        console.log(`Attempting decryption with key version: ${versionId}`);
        const decrypted = await decryptWithRSA(
          keyData.privateKey,
          encryptedData
        );

        if (decrypted) {
          console.log(`Successfully decrypted with key version: ${versionId}`);
          return decrypted;
        }
      } catch (err) {
        console.log(`Decryption failed with key version: ${versionId}`);
      }
    }

    console.log(`Could not decrypt with any available keys`);
    return null;
  };

  const exportKeyForSharing = (versionId) => {
    if (!keyVersions[versionId]) {
      throw new Error("Key version not found");
    }

    const keyData = keyVersions[versionId];

    const shareableKey = {
      versionId: versionId,
      publicKey: keyData.publicKey,
      privateKey: keyData.privateKey,
      createdAt: keyData.createdAt,
      username: keyData.username,
      exportedAt: new Date().toISOString(),
    };

    return btoa(JSON.stringify(shareableKey));
  };

  const importSharedKey = (encodedKeyData) => {
    try {
      const keyData = JSON.parse(atob(encodedKeyData));

      if (
        !keyData.versionId ||
        !keyData.publicKey ||
        !keyData.privateKey ||
        !keyData.username ||
        !keyData.createdAt
      ) {
        throw new Error("Invalid key data: missing required fields");
      }

      const updatedKeyVersions = {
        ...keyVersions,
        [keyData.versionId]: {
          publicKey: keyData.publicKey,
          privateKey: keyData.privateKey,
          createdAt: keyData.createdAt,
          username: keyData.username,
          isImported: true,
          importedAt: new Date().toISOString(),
        },
      };

      setKeyVersions(updatedKeyVersions);
      localStorage.setItem("keyVersions", JSON.stringify(updatedKeyVersions));

      console.log(
        `Imported key ${keyData.versionId} for user ${keyData.username}`
      );
      return keyData.versionId;
    } catch (err) {
      console.error("Error importing shared key:", err);
      throw new Error("Failed to import key: " + err.message);
    }
  };

  const backupAllKeys = () => {
    try {
      const allKeys = {
        keyPair: keyPair,
        userKeyPairs: userKeyPairs,
        keyVersions: keyVersions,
        exportedAt: new Date().toISOString(),
      };

      const encoded = btoa(JSON.stringify(allKeys));

      const blob = new Blob([encoded], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `secure-chat-keys-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      return true;
    } catch (err) {
      console.error("Error backing up keys:", err);
      throw new Error("Failed to backup keys: " + err.message);
    }
  };

  const restoreKeysFromBackup = (encodedBackup) => {
    try {
      const backup = JSON.parse(atob(encodedBackup));

      if (!backup.keyPair || !backup.keyVersions) {
        throw new Error("Invalid backup data");
      }

      setKeyPair(backup.keyPair);
      setUserKeyPairs(backup.userKeyPairs || {});
      setKeyVersions(backup.keyVersions);

      localStorage.setItem("keyPair", JSON.stringify(backup.keyPair));
      localStorage.setItem(
        "userKeyPairs",
        JSON.stringify(backup.userKeyPairs || {})
      );
      localStorage.setItem("keyVersions", JSON.stringify(backup.keyVersions));

      console.log("Keys restored from backup");
      return true;
    } catch (err) {
      console.error("Error restoring backup:", err);
      throw new Error("Failed to restore backup: " + err.message);
    }
  };

  useEffect(() => {
    const fetchServerPublicKey = async () => {
      try {
        const res = await axios.get("/api/keys/server-public");
        setServerPublicKey(res.data.publicKey);
      } catch (err) {
        console.error("Error fetching server public key:", err);
        setError("Failed to fetch server public key");
      } finally {
        setLoading(false);
      }
    };

    fetchServerPublicKey();
  }, []);

  const importRSAKey = async (pem, isPrivate = false) => {
    try {
      const pemContents = pem
        .replace(/-----BEGIN (PUBLIC|PRIVATE) KEY-----/g, "")
        .replace(/-----END (PUBLIC|PRIVATE) KEY-----/g, "")
        .replace(/\s/g, "");

      const binaryDer = Uint8Array.from(atob(pemContents), (c) =>
        c.charCodeAt(0)
      );

      return await window.crypto.subtle.importKey(
        isPrivate ? "pkcs8" : "spki",
        binaryDer,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        false,
        isPrivate ? ["decrypt"] : ["encrypt"]
      );
    } catch (err) {
      console.error("Error importing RSA key:", err);
      throw new Error("Failed to import RSA key");
    }
  };

  const encryptWithRSA = async (publicKeyPem, data) => {
    try {
      const publicKey = await importRSAKey(publicKeyPem);

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
        },
        publicKey,
        dataBuffer
      );

      return btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    } catch (err) {
      console.error("Error encrypting with RSA:", err);
      throw new Error("Failed to encrypt data");
    }
  };

  const decryptWithRSA = async (privateKeyPem, encryptedData) => {
    try {
      const privateKey = await importRSAKey(privateKeyPem, true);

      const encryptedBuffer = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0)
      );

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
        },
        privateKey,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      console.log("Error decrypting with RSA no key shared:", err);
      throw new Error("Failed to decrypt data");
    }
  };

  const generateAESKey = async () => {
    try {
      const key = await window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256,
        },
        true,
        ["encrypt", "decrypt"]
      );

      const exportedKey = await window.crypto.subtle.exportKey("raw", key);
      const keyHex = Array.from(new Uint8Array(exportedKey))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return { key, keyHex };
    } catch (err) {
      console.error("Error generating AES key:", err);
      throw new Error("Failed to generate AES key");
    }
  };

  const encryptWithAES = async (key, plaintext) => {
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const encoder = new TextEncoder();
      const plaintextBuffer = encoder.encode(plaintext);

      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv,
          tagLength: 128,
        },
        key,
        plaintextBuffer
      );

      const encryptedHex = Array.from(new Uint8Array(encryptedBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const ivHex = Array.from(iv)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return {
        encryptedContent: encryptedHex,
        iv: ivHex,
      };
    } catch (err) {
      console.error("Error encrypting with AES:", err);
      throw new Error("Failed to encrypt message");
    }
  };

  const decryptWithAES = async (key, encryptedContent, iv) => {
    try {
      const encryptedBuffer = new Uint8Array(
        encryptedContent.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
      );

      const ivBuffer = new Uint8Array(
        iv.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
      );

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ivBuffer,
          tagLength: 128,
        },
        key,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      console.error("Error decrypting with AES:", err);
      throw new Error("Failed to decrypt message");
    }
  };

  const importAESKey = async (keyHex) => {
    try {
      const keyBuffer = new Uint8Array(
        keyHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
      );

      return await window.crypto.subtle.importKey(
        "raw",
        keyBuffer,
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        ["encrypt", "decrypt"]
      );
    } catch (err) {
      console.error("Error importing AES key:", err);
      throw new Error("Failed to import AES key");
    }
  };

  const clearAllKeys = () => {
    localStorage.removeItem("keyPair");
    localStorage.removeItem("userKeyPairs");
    localStorage.removeItem("keyVersions");
    setKeyPair(null);
    setUserKeyPairs({});
    setKeyVersions({});
  };

  const value = {
    keyPair,
    userKeyPairs,
    keyVersions,
    serverPublicKey,
    loading,
    error,
    encryptWithRSA,
    decryptWithRSA,
    generateAESKey,
    encryptWithAES,
    decryptWithAES,
    importAESKey,
    generateNewKeyPair,
    getUserKeyVersions,
    tryDecryptWithAllKeys,
    exportKeyForSharing,
    importSharedKey,
    backupAllKeys,
    restoreKeysFromBackup,
    clearAllKeys,
  };

  return (
    <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>
  );
};

export default CryptoContext;
