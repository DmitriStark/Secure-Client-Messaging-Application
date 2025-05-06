# Secure Messaging Application

A scalable, end-to-end encrypted messaging system designed to handle 10,000+ concurrent connections with high security and performance.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Security Implementation](#security-implementation)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Scalability Optimizations](#scalability-optimizations)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)

## Overview

This application provides a secure messaging platform with end-to-end encryption, ensuring that messages can only be read by the intended recipients. The system is designed to handle high volumes of concurrent users (10,000+) while maintaining performance and security.

## Features

- **User Authentication**: Secure registration and login with Argon2 password hashing
- **End-to-End Encryption**: RSA for key exchange, AES-256-GCM for message content
- **Real-time Messaging**: Long-polling implementation for message delivery without WebSockets
- **Message Broadcasting**: Efficiently send messages to multiple recipients
- **Message History**: Retrieve past messages with pagination
- **Encrypted Storage**: All messages stored encrypted in the database
- **Scalability**: Cluster-based approach to utilize all available CPU cores
- **High Concurrency**: Optimized for 10,000+ concurrent connections

## Architecture

### Server Components

- **Node.js with Express**: Backend server framework
- **MongoDB**: Database for user accounts and encrypted messages
- **Clustering**: Multi-process architecture to utilize all CPU cores
- **Winston**: Advanced logging system with rotation and levels

### Client Components

- **React**: Frontend framework
- **React Context API**: State management for authentication, cryptography, and messaging
- **Web Crypto API**: Browser-based cryptography for end-to-end encryption
- **Axios**: HTTP client for API requests
- **Bootstrap**: UI framework for responsive design

## Security Implementation

### Encryption Methods

- **RSA-OAEP (4096 bits)**: For secure key exchange and authentication
- **AES-GCM (256 bits)**: For high-performance symmetric encryption of message content
- **Argon2id**: For secure password hashing with resistance to various attacks

### Key Management

- Each user generates a public/private key pair during registration
- Private keys are never sent to the server and remain client-side only
- Public keys are stored on the server and shared with other users
- Symmetric keys for message encryption are generated per message and shared securely

### Authentication Flow

1. User registers with username, password, and generated public key
2. Passwords are hashed with Argon2id before storage
3. JWT tokens are issued upon successful authentication
4. All API endpoints (except registration and login) require valid JWT

### Message Security

1. Sender generates a random AES key for the message
2. Message is encrypted with this AES key
3. The AES key is encrypted with each recipient's public key
4. Server receives the encrypted message and encrypted keys, but cannot decrypt the content
5. Recipients retrieve the message and decrypt the AES key with their private key
6. Message content is then decrypted with the AES key

## Installation

### Prerequisites

- Node.js (v14+)
- MongoDB (v4.4+)
- npm or yarn

### Server Setup

```bash
# Clone repository
git clone https://github.com/yourusername/secure-messaging-app.git
cd secure-messaging-app

# Install server dependencies
cd server
npm install

# Create .env file (see Configuration section)
cp .env.example .env
```

### Client Setup

```bash
# Navigate to client directory
cd ../client

# Install client dependencies
npm install

# Create .env file for client
cp .env.example .env
```

## Configuration

### Server Environment Variables

Create a `.env` file in the server directory with the following variables:

```
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/secure-chat

# Authentication
JWT_SECRET=your_secure_jwt_secret_here
JWT_EXPIRATION=24h

# Logging
LOG_LEVEL=info
```

### Client Environment Variables

Create a `.env` file in the client directory:

```
REACT_APP_API_URL=http://localhost:3001/api
```

## Usage

### Starting the Server

```bash
# Navigate to server directory
cd server

# Development mode
npm run dev

# Production mode
npm start
```

### Starting the Client

```bash
# Navigate to client directory
cd client

# Development mode
npm start

# Build for production
npm run build
```

### Seeding the Database

A script is provided to seed the database with mock users and messages:

```bash
# Navigate to server directory
cd server

# Run the seed script
node scripts/seed.js
```

This creates several test users with credentials and generates sample encrypted messages.

## API Documentation

### Authentication Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/auth/register` | POST | Register a new user | No |
| `/api/auth/login` | POST | Log in and get a token | No |
| `/api/auth/profile` | GET | Get user profile | Yes |
| `/api/auth/verify` | POST | Verify token validity | No |
| `/api/auth/logout` | POST | Invalidate token | Yes |

### Message Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/messages/poll` | GET | Long polling for new messages | Yes |
| `/api/messages/send` | POST | Send a new message | Yes |
| `/api/messages/history` | GET | Get message history with pagination | Yes |
| `/api/messages/:messageId` | GET | Get a specific message | Yes |
| `/api/messages/:messageId/read` | POST | Mark a message as read | Yes |
| `/api/messages/status` | GET | Get server status and metrics | Yes |

### Key Management Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/keys/server-public` | GET | Get server's public key | No |
| `/api/keys/user/:username` | GET | Get a user's public key | No |
| `/api/keys/users` | GET | Get all users' public keys | Yes |

### User Management Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/users/public-keys` | GET | Get all users' public keys | Yes |
| `/api/users/update-key` | POST | Update user's public key | Yes |