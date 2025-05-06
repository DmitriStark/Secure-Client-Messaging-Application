# Secure Client-Server Messaging Application

A secure messaging application with end-to-end encryption, authentication, and message broadcasting capability.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Setup Instructions](#setup-instructions)
- [Security Design](#security-design)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Trade-offs and Limitations](#trade-offs-and-limitations)

## Overview

This application is a secure client-server messaging system that allows multiple clients to communicate with each other using end-to-end encryption. The system handles user authentication, message encryption, and message broadcasting without using WebSockets.

## Features

- User registration and authentication
- End-to-end encryption using RSA and AES
- Message broadcasting to all connected clients
- Long polling for real-time message updates
- Secure password storage with Argon2 hashing
- Message history retrieval
- Encrypted message storage (at rest)
- High concurrency support (10,000+ connections)
- Comprehensive logging and monitoring

## Technology Stack

### Server

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **MongoDB** - Database for storing users and messages
- **Mongoose** - MongoDB object modeling
- **Argon2** - Password hashing
- **JWT** - JSON Web Tokens for authentication
- **Crypto** - Node.js built-in crypto for encryption/decryption
- **Winston** - Logging

### Client

- **React** - Frontend framework
- **Bootstrap** - UI framework
- **Axios** - HTTP client
- **Web Crypto API** - Browser cryptography

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB
- npm or yarn

### Server Setup

1. Clone the repository
2. Navigate to the server directory
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file based on `.env.example`
5. Start the server:
   ```
   npm start
   ```

For development mode with auto-reloading:
```
npm run dev
```

### Client Setup

1. Navigate to the client directory
2. Install dependencies:
   ```
   npm install
   ```
3. Start the client:
   ```
   npm start
   ```

### Database Seeding

To seed the database with mock users and messages:
```
npm run seed
```

This will create test users and sample messages to help with testing.

## Security Design

### Authentication

- Passwords are hashed using Argon2id (more secure than bcrypt)
- JSON Web Tokens (JWT) for session management
- Rate limiting to prevent brute force attacks

### Encryption

1. **Key Management**:
   - Each client generates an RSA key pair (4096 bits) for asymmetric encryption
   - The server has its own RSA key pair
   - The client stores its private key locally and sends the public key to the server during registration

2. **Message Encryption**:
   - Hybrid encryption approach (RSA + AES)
   - Each message uses a randomly generated AES-256-GCM key for symmetric encryption
   - The symmetric key is encrypted with the server's public RSA key
   - Messages are stored encrypted in the database

3. **Message Transport**:
   - All communication uses HTTPS (TLS)
   - Message broadcasting implemented using long polling
   - Messages are end-to-end encrypted

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/verify` - Verify JWT token

### Key Management Endpoints

- `GET /api/keys/server-public` - Get server's public key
- `GET /api/keys/user/:username` - Get user's public key
- `GET /api/keys/users` - Get all users' public keys

### Message Endpoints

- `POST /api/messages/send` - Send a message (to be broadcasted)
- `GET /api/messages/poll` - Long polling for receiving messages
- `GET /api/messages/history` - Get message history
- `GET /api/messages/:messageId` - Get a specific message

## Testing

Run the test suite:
```
npm test
```

The tests include:
- User authentication
- Message encryption/decryption
- Message broadcasting

## Trade-offs and Limitations

1. **Long Polling vs WebSockets**:
   - Long polling is used instead of WebSockets as per requirements
   - This increases server load as connections are repeatedly established and torn down
   - It may cause minor delays in message delivery

2. **Key Management**:
   - Client private keys are stored in localStorage for simplicity
   - In a production system, more secure storage would be advisable
   - No key rotation mechanism is implemented

3. **Scalability Concerns**:
   - MongoDB could become a bottleneck at very high volumes
   - Consider sharding or a specialized database for messages
   - Long polling may impact performance with many concurrent users

4. **Security Considerations**:
   - No perfect forward secrecy (PFS) implementation
   - No message expiration or self-destruction mechanism
   - No two-factor authentication (2FA)

5. **Message Queuing**:
   - For a more robust solution in production, consider implementing a message queue system (e.g., RabbitMQ, Kafka)
   - This would help handle high loads and ensure message delivery even during service disruptions