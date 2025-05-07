# Secure Messaging Client

A React-based front-end application for end-to-end encrypted messaging with advanced key management.

## Features

- **End-to-End Encryption**: All messages are encrypted client-side using modern cryptography.
- **RSA Key Generation**: Creates 4096-bit RSA keys for secure key exchange.
- **AES Message Encryption**: Messages encrypted with AES-GCM 256-bit symmetric encryption.
- **User Authentication**: Secure login/registration with JWT token management.
- **Message Polling**: Real-time message delivery through long polling.
- **Responsive Design**: Built with Bootstrap for a responsive, mobile-friendly interface.
- **Key Versioning**: Support for multiple encryption keys with versioning.
- **Key Sharing**: Share encryption keys securely between users.
- **Message Key Sharing**: Share individual message keys with specific users.
- **Key Backup & Restore**: Export and import keys for safekeeping and cross-device use.
- **Multi-Key Decryption**: Automatically try all available keys to decrypt messages.

## Prerequisites

- Node.js (v14+)
- NPM or Yarn
- Secure Messaging Server (running locally or deployed)

## Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/secure-messaging.git
cd secure-messaging/client
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm start
```

The app will open in your browser at `http://localhost:3000`.

## Architecture

The application is built with several React contexts to manage state:

### AuthContext

Handles user authentication, including:
- Registration
- Login
- JWT token management
- Session persistence

### CryptoContext

Manages cryptographic operations:
- RSA key pair generation (4096-bit)
- PEM formatting of keys
- RSA encryption/decryption
- AES key generation
- AES encryption/decryption
- Key versioning and management
- Key sharing and importing
- Key backup and restoration

### MessageContext

Manages messaging functionality:
- Message sending
- Message polling
- Message history
- Message decryption
- Message key management
- Message key sharing

## Components

- **App**: Main application component
- **Header**: Navigation header with authentication status
- **Register**: User registration form
- **Login**: User login form
- **ChatRoom**: Main messaging interface with key management
- **PrivateRoute**: Authentication-protected routes

## Cryptography Implementation

### Key Management

- **Key Versioning**: Each key pair is versioned with a unique ID and timestamp
- **Multiple Keys**: Users can generate multiple keys and store them for future use
- **Key Sharing**: Keys can be exported in a secure format and shared with trusted users
- **Key Backup**: All keys can be exported to a backup file and restored when needed
- **Key Import**: Keys from other users can be imported to decrypt their messages

### Key Generation

- RSA key pairs (4096-bit) are generated using the Web Crypto API
- Keys are properly formatted in PEM format with headers and footers
- Public keys are shared with the server during registration
- Private keys remain client-side only
- New keys can be generated at any time without losing access to old messages

### Message Encryption

1. A random AES-GCM 256-bit key is generated for each message
2. The message is encrypted with this AES key
3. The AES key is encrypted with each recipient's public RSA key
4. The encrypted message and encrypted keys are sent to the server

### Message Decryption

1. The client receives an encrypted message
2. The client attempts to decrypt the AES key using their current private RSA key
3. If that fails, the client tries all available keys in the key store
4. If decryption still fails, the user can import a specific key for that message
5. The decrypted AES key is used to decrypt the message content

## Key Sharing Features

Our application now includes robust key sharing capabilities:

### Key Management UI

- **Key Dashboard**: View all your encryption keys with their creation dates and status
- **Generate Keys**: Create new keys at any time with a single click
- **Share Keys**: Export any of your keys to share with trusted contacts
- **Import Keys**: Import keys shared by others to decrypt their messages
- **Backup All Keys**: Export all your keys to a single backup file
- **Restore from Backup**: Restore all your keys from a backup file

### Message Key Sharing

- **Share Per-Message**: Export the encryption key for a specific message
- **Import Per-Message**: Import a key for a specific encrypted message
- **Multi-Key Decryption**: Automatically try all available keys for any message

## Best Practices

- Never store unencrypted messages
- Keep private keys secure (currently stored in localStorage)
- Validate all user inputs
- Handle authentication errors gracefully
- Implement proper loading states
- Backup your encryption keys regularly
- Share keys only through secure channels

## Security Considerations

While this application implements strong encryption, there are some aspects that could be improved:

- Private keys are stored in localStorage, which is vulnerable to XSS attacks
- No perfect forward secrecy implementation
- Password requirements could be strengthened
- No multi-factor authentication
- Key sharing should ideally occur through a separate secure channel

## Development and Extension

To extend this application:

1. **Adding Contacts/Groups**: Implement contact management and group messaging
2. **Message Attachments**: Add support for encrypted file transfers
3. **Key Rotation**: Implement automated key rotation for improved security
4. **Offline Support**: Add offline capabilities with message queuing
5. **Enhanced UI**: Add themes, message formatting, and emoji support
6. **Secure Key Exchange**: Implement a more secure key exchange protocol

## Building for Production

To create a production build:

```bash
npm run build
```

This will generate optimized production files in the `build` directory.

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.