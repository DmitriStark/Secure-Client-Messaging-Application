# Secure Messaging Client

A React-based front-end application for end-to-end encrypted messaging.

## Features

- **End-to-End Encryption**: All messages are encrypted client-side using modern cryptography.
- **RSA Key Generation**: Creates 4096-bit RSA keys for secure key exchange.
- **AES Message Encryption**: Messages encrypted with AES-GCM 256-bit symmetric encryption.
- **User Authentication**: Secure login/registration with JWT token management.
- **Message Polling**: Real-time message delivery through long polling.
- **Responsive Design**: Built with Bootstrap for a responsive, mobile-friendly interface.

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

### MessageContext

Manages messaging functionality:
- Message sending
- Message polling
- Message history
- Message decryption

## Components

- **App**: Main application component
- **Header**: Navigation header with authentication status
- **Register**: User registration form
- **Login**: User login form
- **ChatRoom**: Main messaging interface
- **PrivateRoute**: Authentication-protected routes

## Cryptography Implementation

### Key Generation

- RSA key pairs (4096-bit) are generated using the Web Crypto API
- Keys are properly formatted in PEM format with headers and footers
- Public keys are shared with the server during registration
- Private keys remain client-side only

### Message Encryption

1. A random AES-GCM 256-bit key is generated for each message
2. The message is encrypted with this AES key
3. The AES key is encrypted with each recipient's public RSA key
4. The encrypted message and encrypted keys are sent to the server

### Message Decryption

1. The client receives an encrypted message
2. The client decrypts the AES key using their private RSA key
3. The decrypted AES key is used to decrypt the message content

## Best Practices

- Never store unencrypted messages
- Keep private keys secure (currently stored in localStorage)
- Validate all user inputs
- Handle authentication errors gracefully
- Implement proper loading states

## Security Considerations

While this application implements strong encryption, there are some aspects that could be improved:

- Private keys are stored in localStorage, which is vulnerable to XSS attacks
- No perfect forward secrecy implementation
- Password requirements could be strengthened
- No multi-factor authentication

## Development and Extension

To extend this application:

1. **Adding Contacts/Groups**: Implement contact management and group messaging
2. **Message Attachments**: Add support for encrypted file transfers
3. **Key Rotation**: Implement key rotation for improved security
4. **Offline Support**: Add offline capabilities with message queuing
5. **Enhanced UI**: Add themes, message formatting, and emoji support

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