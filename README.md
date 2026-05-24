# al-mizan-auth-service

> **Service d'Authentification** — Gestion des sessions, JWT, OTP et réinitialisation de mot de passe pour la plateforme Al-Mizan.

---

## Table des matières

1. [Aperçu](#aperçu)
2. [Technologies](#technologies)
3. [Architecture & Réseau](#architecture--réseau)
4. [Base de données](#base-de-données)
5. [Variables d'environnement](#variables-denvironnement)
6. [API REST](#api-rest)
7. [Messagerie RabbitMQ](#messagerie-rabbitmq)
8. [Commandes utiles](#commandes-utiles)
9. [Docker](#docker)

---

## Aperçu

`al-mizan-auth-service` est le service central d'authentification de la plateforme Al-Mizan. Il est responsable de :

- L'inscription des utilisateurs (`SERVICE_CONTRACTANT`, `OPERATEUR_ECONOMIQUE`) avec émission d'un événement RabbitMQ.
- La gestion des sessions via **Refresh Token** (cookie HTTP-Only) + **Access Token** (JWT).
- La gestion des codes **OTP** par email (via Resend) pour la vérification en deux étapes.
- La réinitialisation de mot de passe par email.
- La fourniture d'un **Swagger UI** interactif.

Le service fonctionne en **Express.js (v5)** avec **TypeScript** (ESM), **Prisma ORM** sur **MySQL**, et **Redis** pour le stockage des OTPs et le blacklistage des tokens.

---

## Technologies

| Technologie          | Version  | Rôle                                      |
|----------------------|----------|-------------------------------------------|
| Node.js              | 20 LTS   | Runtime                                   |
| TypeScript           | ^5.9     | Langage                                   |
| Express.js           | ^5.2     | Framework HTTP                            |
| Prisma ORM           | ^5.22    | ORM + migrations MySQL                    |
| MySQL                | 8.x      | Base de données principale                |
| Redis                | ^5.11    | Cache OTP / Blacklist tokens              |
| amqplib              | ^1.0     | Client RabbitMQ (événements)              |
| amqp-connection-manager | ^5.0 | Reconnexion automatique RabbitMQ          |
| jsonwebtoken         | ^9.0     | Génération/vérification JWT               |
| bcryptjs             | ^3.0     | Hachage des mots de passe                 |
| Resend               | ^6.12    | Envoi d'emails transactionnels            |
| swagger-jsdoc        | ^6.2     | Génération de la spec OpenAPI depuis JSDoc|
| swagger-ui-express   | ^5.0     | UI Swagger intégrée                       |
| Jest                 | ^29.7    | Tests unitaires & d'intégration           |

---

## Architecture & Réseau

```
Internet → API Gateway (:3000)
                │
                └──► auth-service (:3001)  [Réseau Docker: al-mizan-network]
                          │
                          ├── MySQL  (mysql:3306 → auth_db)
                          ├── Redis  (redis:6379)
                          └── RabbitMQ (rabbitmq:5672)
```

- **Port exposé** : `3001`
- **Réseau Docker** : `al-mizan-network`
- **Nom du conteneur** : `auth-service`
- **Swagger UI** : `http://localhost:3001/api-docs`

---

## Base de données

**Moteur** : MySQL 8 · **Schema** : `auth_db`

### Modèles Prisma

#### `User`
| Champ       | Type      | Contrainte          |
|-------------|-----------|---------------------|
| `id`        | String    | PK, UUID auto       |
| `email`     | String    | UNIQUE              |
| `password`  | String    | Hashé (bcryptjs)    |
| `isActive`  | Boolean   | Défaut `false`      |
| `created_at`| DateTime  | Défaut `now()`      |

#### `Session`
| Champ        | Type     | Contrainte                  |
|--------------|----------|-----------------------------|
| `id`         | String   | PK, UUID auto               |
| `token`      | String   | UNIQUE (refresh token)      |
| `deviceInfo` | String?  | Optionnel                   |
| `ipAddress`  | String?  | Optionnel                   |
| `expiresAt`  | DateTime |                             |
| `userId`     | String   | FK → User (Cascade Delete)  |

#### `PasswordReset`
| Champ      | Type     | Contrainte                 |
|------------|----------|----------------------------|
| `id`       | String   | PK, UUID auto              |
| `token`    | String   | UNIQUE                     |
| `used`     | Boolean  | Défaut `false`             |
| `expiresAt`| DateTime |                            |
| `userId`   | String   | FK → User (Cascade Delete) |

---

## Variables d'environnement

Copier `.env.example` → `.env` et renseigner les valeurs :

```env
# Serveur
PORT=3001

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=auth_db
DB_USER=root
DB_PASSWORD=
DATABASE_URL="mysql://root@localhost:3306/auth_db"

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# JWT
ACCESS_TOKEN_SECRET=replace_with_strong_access_secret
REFRESH_TOKEN_SECRET=replace_with_strong_refresh_secret
ACCESS_TOKEN_EXPIRY=15m
```

> ⚠️ En production (Docker), remplacer `localhost` par le nom du conteneur : `mysql`, `redis`, `rabbitmq`.

---

## API REST

Base URL (via Gateway) : `http://localhost:3000/auth`  
Base URL (directe) : `http://localhost:3001`  
Swagger : `http://localhost:3001/api-docs`

### Inscription & Connexion

| Méthode | Endpoint                   | Auth | Description                                      |
|---------|----------------------------|------|--------------------------------------------------|
| `POST`  | `/api/v1/auth/register`    | Non  | Inscription (Service Contractant ou OE)          |
| `POST`  | `/api/v1/auth/login`       | Non  | Connexion → Access Token + Refresh Token (cookie)|
| `POST`  | `/api/v1/auth/refresh`     | Non  | Renouveau de l'Access Token via Refresh Token    |
| `POST`  | `/api/v1/auth/logout`      | Oui  | Déconnexion de la session courante               |
| `POST`  | `/api/v1/auth/logout-all`  | Oui  | Déconnexion de toutes les sessions               |

### Gestion du profil & sessions

| Méthode   | Endpoint                        | Auth | Description                    |
|-----------|---------------------------------|------|--------------------------------|
| `GET`     | `/api/v1/auth/me`               | Oui  | Informations utilisateur courant|
| `GET`     | `/api/v1/auth/sessions`         | Oui  | Liste de toutes les sessions    |
| `DELETE`  | `/api/v1/auth/sessions/:id`     | Oui  | Révoquer une session spécifique |

### Mot de passe

| Méthode | Endpoint                          | Auth | Description                          |
|---------|-----------------------------------|------|--------------------------------------|
| `POST`  | `/api/v1/auth/forgot-password`    | Non  | Demande de réinitialisation par email|
| `POST`  | `/api/v1/auth/verify-token`       | Non  | Vérifier la validité du token reset  |
| `POST`  | `/api/v1/auth/reset-password`     | Non  | Réinitialiser le mot de passe        |
| `POST`  | `/api/v1/auth/change-password`    | Oui  | Changer le mot de passe (connecté)   |

### OTP (One-Time Password)

| Méthode | Endpoint                    | Auth | Description                          |
|---------|-----------------------------|------|--------------------------------------|
| `POST`  | `/api/v1/auth/otp/send`     | Non  | Envoyer un code OTP à 6 chiffres     |
| `POST`  | `/api/v1/auth/otp/verify`   | Non  | Vérifier le code OTP soumis          |

#### Exemple `POST /api/v1/auth/register`

```json
{
  "email": "sc@ministere.dz",
  "password": "MyPassword123",
  "role": "SERVICE_CONTRACTANT",
  "nom": "Benali",
  "prenom": "Ahmed",
  "denomination": "Ministère des Finances",
  "type": "MINISTERE",
  "code_service": "SC-001",
  "wilaya": "Alger"
}
```

Réponse `201 Created` :
```json
{
  "message": "Account created. Verify your email.",
  "user_id": "uuid-xxxx-xxxx"
}
```

---

## Messagerie RabbitMQ

**Exchange** : `al-mizan.events` (type: `topic`, durable: `true`)

### Événements publiés

| Routing Key          | Déclencheur                | Payload clés                              |
|----------------------|----------------------------|-------------------------------------------|
| `user.registered`    | Inscription réussie        | `user_id`, `email`, `role`, `correlation_id` |
| `notifications.user` | Profil créé avec succès    | `user_id`, `email`, `action`, `langue`    |

### Queues consommées

| Queue                      | Routing Key              | Rôle                                               |
|----------------------------|--------------------------|----------------------------------------------------|
| `user.registered.response` | `user.registered.response` | Réponse du users-service après création du profil  |
| `user.registered.failed`   | `user.registered.failed`   | Échec de création du profil (log d'erreur)         |

#### Flux d'inscription complet :

```
auth-service ──[user.registered]──► users-service
                                        │
                                        ├─ succès ──[user.registered.response]──► auth-service
                                        │                                             │
                                        │                                      ──[notifications.user]──► notification-service
                                        └─ échec ──[user.registered.failed]──► auth-service (log)
```

---

## Commandes utiles

### Développement local

```bash
# Installer les dépendances
npm install

# Démarrer en mode dev (hot-reload)
npm run dev

# Compiler TypeScript
npm run build

# Démarrer en production
npm start
```

### Base de données

```bash
# Appliquer le schéma Prisma à la base (sans migration)
npx prisma db push

# Générer le client Prisma
npx prisma generate

# Lancer le seed (admin par défaut)
npm run db:seed

# Ouvrir Prisma Studio
npx prisma studio
```

### Tests

```bash
# Lancer les tests
npm test

# Tests avec couverture de code
npm run test:coverage
```

---

## Docker

### Build de l'image

```bash
docker build -t al-mizan-auth-service .
```

### Notes importantes sur le Dockerfile

- Image de base : `node:20-alpine`
- **`openssl` est installé explicitement** (`apk add --no-cache openssl`) car Prisma en a besoin sur Alpine.
- Au démarrage du conteneur : `npx prisma db push && node dist/app.js`

### Déploiement via docker-compose

```bash
# Depuis al-mizan-deployments/
docker-compose up -d auth-service
docker-compose logs -f auth-service
```

---

*Maintenu par l'équipe Al-Mizan — voir `al-mizan-deployments` pour la configuration de déploiement complète.*
