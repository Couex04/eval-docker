# Évaluation Docker — Application web multi-conteneurs

Application de démonstration conteneurisée avec **React (Vite)**, **Node.js / Express** et **PostgreSQL**. Le projet présente une configuration de développement, une simulation de production avec **Nginx**, l'isolation réseau, la persistance des données, les secrets Docker Compose et la publication d'images multi-architectures.

## 1. Architecture

```text
Navigateur
    |
    +-- Développement : http://localhost:5173 (Vite)
    |                       |
    +-- Production    : http://localhost:8080 (Nginx)
                            |
                      front_net
                            |
                      backend:3001 (Express)
                            |
                      back_net (interne)
                            |
                        db:5432 (PostgreSQL)
                            |
                     volume nommé pg_data
```

| Service | Technologie | Rôle | Réseau(x) |
| --- | --- | --- | --- |
| `frontend` | React, Vite (dev), Nginx (prod) | Interface web et transfert des requêtes `/api` | `front_net` |
| `backend` | Node.js 24, Express, `pg` | API REST et accès aux données | `front_net`, `back_net` |
| `db` | PostgreSQL 18 | Stockage persistant des instructions | `back_net` |

Le réseau `back_net` est défini avec `internal: true`. PostgreSQL ne publie aucun port sur l'hôte. En production, seul le port HTTP `8080` du frontend est publié ; le backend demeure accessible aux autres services sur le réseau Docker.

## 2. Prérequis

- Docker Desktop (ou Docker Engine avec le plugin Docker Compose) démarré.
- Docker Compose récent, compatible avec les balises `!override` et `!reset` utilisées dans `compose.prod.yaml` (**Docker Compose 2.24.4 ou ultérieur**).
- PowerShell pour les commandes ci-dessous (ou l'équivalent dans un autre terminal).
- Pour reconstruire et publier en AMD64/ARM64 : Docker Buildx et un builder compatible.

La compilation et le démarrage avec Compose ne nécessitent pas l'installation locale de Node.js.

## 3. Installation initiale

Cloner le dépôt ou extraire le projet, puis se placer dans son répertoire racine :

```powershell
cd eval-docker
```

Créer le fichier de mot de passe PostgreSQL à partir du modèle :

```powershell
Copy-Item secrets/db_password.txt.example secrets/db_password.txt
```

**Remplacer ensuite le contenu de `secrets/db_password.txt` par un mot de passe personnel suffisamment robuste**, avant le tout premier démarrage. Le fichier réel est exclu de Git ; seul `secrets/db_password.txt.example` est destiné à être versionné.

> Cette copie ne doit être exécutée que lors d'une nouvelle installation : si `secrets/db_password.txt` existe déjà, ne pas le remplacer. Le mot de passe de la base est fixé au premier initialisation du volume PostgreSQL ; modifier simplement le fichier de secret après coup ne change pas le mot de passe déjà enregistré dans la base.

Vérifier les fichiers Compose :

```powershell
docker compose config
```

## 4. Démarrage en développement

```powershell
docker compose up -d --build
docker compose ps
```

- Interface React (Vite) : **http://localhost:5173**
- API de santé : **http://localhost:3001/api/health**
- Première instruction : **http://localhost:3001/api/instruction**

Le proxy Vite transmet `/api` au backend sur le réseau `front_net`. Les images sont construites avec les targets `development` définies dans les Dockerfiles.

Arrêter les services :

```powershell
docker compose down
```

## 5. Démarrage en production simulée

Le fichier `compose.prod.yaml` complète `compose.yaml` : il sélectionne les targets `production`, remplace Vite par Nginx et retire la publication du port du backend.

```powershell
docker compose -f compose.yaml -f compose.prod.yaml config
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
docker compose -f compose.yaml -f compose.prod.yaml ps
```

- Interface React : **http://localhost:8080**
- API via Nginx : **http://localhost:8080/api/instruction**

En production, Nginx sert les fichiers statiques issus de `npm run build` et agit comme reverse proxy pour `/api`.

Arrêter cette configuration :

```powershell
docker compose -f compose.yaml -f compose.prod.yaml down
```

> Pour basculer d'un mode à l'autre, arrêter le mode actif avec `down`, puis lancer l'autre configuration. Ne pas ajouter `-v` à `down` si les données doivent être conservées.

## 6. API et données

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | Indique que le serveur Express répond (`status: ok`). |
| GET | `/api/instruction` | Récupère la première ligne de la table `instructions`, triée par `id`. |

Le script `db/init.sql` crée la table `instructions` (`id`, `message`, `created_at`) et insère un message de démonstration lors de **la première initialisation du volume**. Les scripts placés dans `/docker-entrypoint-initdb.d/` ne sont pas rejoués si une base PostgreSQL existe déjà.

Pour consulter les lignes :

```powershell
docker compose -f compose.yaml -f compose.prod.yaml exec db `
  psql -U postgres -d evaluation -c "SELECT * FROM instructions ORDER BY id;"
```

## 7. Persistance PostgreSQL : procédure de vérification

Avec la production démarrée, ajouter une ligne de test :

```powershell
docker compose -f compose.yaml -f compose.prod.yaml exec db `
  psql -U postgres -d evaluation -c "INSERT INTO instructions (message) VALUES ('Test de persistance Docker');"
```

Supprimer les conteneurs **sans supprimer les volumes**, puis les recréer :

```powershell
docker compose -f compose.yaml -f compose.prod.yaml down
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

Vérifier la présence de l'enregistrement :

```powershell
docker compose -f compose.yaml -f compose.prod.yaml exec db `
  psql -U postgres -d evaluation -c "SELECT * FROM instructions ORDER BY id;"
```

Le test a été effectué : le message `Test de persistance Docker` était toujours présent après recréation des conteneurs. La persistance est assurée par le volume nommé `pg_data` (son nom effectif est préfixé par le nom du projet Compose).

**Attention :** `docker compose down -v` supprime également les volumes déclarés et entraîne la perte des données de ce projet.

## 8. Sécurité et bonnes pratiques

- **Secrets** : mot de passe PostgreSQL fourni à la base via `POSTGRES_PASSWORD_FILE` et lu par Express depuis `/run/secrets/db_password` ; le secret réel n'est pas versionné.
- **Isolation** : PostgreSQL est connecté uniquement à `back_net`, marqué interne ; le backend assure la liaison entre les deux réseaux.
- **Privilèges réduits** : backend exécuté avec l'utilisateur `node` (UID 1000), frontend de production avec `nginx` (UID 101).
- **Healthchecks** : contrôles pour la base, le backend et le frontend ; `depends_on` attend les services en bonne santé.
- **Optimisation des images** : Dockerfiles multi-stage, `npm ci`, copie des fichiers `package*.json` avant le code pour optimiser le cache, `.dockerignore` pour exclure les fichiers inutiles.

Vérifier les utilisateurs dans les conteneurs :

```powershell
docker compose -f compose.yaml -f compose.prod.yaml exec backend id
docker compose -f compose.yaml -f compose.prod.yaml exec frontend id
```

**Limite connue :** la route `/api/health` vérifie la réponse HTTP de l'application mais ne réalise pas de requête SQL. La santé de PostgreSQL est contrôlée séparément par `pg_isready`.

## 9. Construction multi-architecture avec Buildx

Les images de production ont été construites pour **`linux/amd64`** et **`linux/arm64`** avec Buildx.

Exemple de construction en archives OCI locales :

```powershell
docker buildx build `
  --platform linux/amd64,linux/arm64 `
  --target production `
  -t eval-frontend:v1.0.0 `
  --output type=oci,dest=frontend-multiarch.tar `
  ./frontend

docker buildx build `
  --platform linux/amd64,linux/arm64 `
  --target production `
  -t eval-backend:v1.0.0 `
  --output type=oci,dest=backend-multiarch.tar `
  ./backend
```

Les archives `.tar` sont exclues du dépôt Git : elles sont des artefacts locaux et non des sources.

### Images publiées sur GitHub Container Registry

- `ghcr.io/couex04/eval-frontend:v1.0.0`
- `ghcr.io/couex04/eval-backend:v1.0.0`

Le tag `v1.0.0` suit le principe du versioning sémantique (`MAJOR.MINOR.PATCH`) ; `latest` désigne la dernière version stable publiée.

Exemples de publication après authentification GHCR :

```powershell
docker buildx build `
  --platform linux/amd64,linux/arm64 `
  --target production `
  -t ghcr.io/couex04/eval-frontend:v1.0.0 `
  -t ghcr.io/couex04/eval-frontend:latest `
  --push ./frontend

docker buildx build `
  --platform linux/amd64,linux/arm64 `
  --target production `
  -t ghcr.io/couex04/eval-backend:v1.0.0 `
  -t ghcr.io/couex04/eval-backend:latest `
  --push ./backend
```

Vérifier les manifestes publiés :

```powershell
docker buildx imagetools inspect ghcr.io/couex04/eval-frontend:v1.0.0
docker buildx imagetools inspect ghcr.io/couex04/eval-backend:v1.0.0
```

Ces deux vérifications ont confirmé les manifestes `linux/amd64` et `linux/arm64`. Les éventuelles entrées `unknown/unknown` correspondent aux attestations Buildx.

## 10. Dépannage

| Problème | Vérification / solution |
| --- | --- |
| Un conteneur n'est pas `healthy` | `docker compose ps` puis `docker compose logs <service>` |
| Le frontend ne récupère pas l'API | Vérifier le service `backend`, les réseaux et la configuration du proxy Vite ou Nginx. |
| Le secret est introuvable | Vérifier l'existence de `secrets/db_password.txt` et relancer Compose. |
| PostgreSQL refuse le mot de passe après modification | Le mot de passe déjà initialisé dans le volume n'a pas changé ; restaurer le secret initial ou changer le mot de passe dans PostgreSQL. |
| `compose.prod.yaml` refuse `!override` / `!reset` | Mettre à jour Docker Compose (version 2.24.4 ou supérieure). |
| Le port 5173 ou 8080 est occupé | Arrêter l'ancienne stack avec `docker compose down` et vérifier les conteneurs déjà lancés. |

Consulter les logs de production :

```powershell
docker compose -f compose.yaml -f compose.prod.yaml logs --tail=100
```

## 11. Organisation des fichiers

```text
eval-docker/
├── backend/
│   ├── src/index.js
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── package.json
│   └── package-lock.json
├── db/
│   └── init.sql
├── secrets/
│   ├── db_password.txt.example  # versionné
│   └── db_password.txt          # local, ignoré par Git
├── compose.yaml
├── compose.prod.yaml
├── .gitignore
└── README.md
```

## 12. Bilan

Ce projet met en œuvre une application web à trois services, avec deux réseaux Docker, persistance et secrets, modes développement/production, healthchecks, exécution non-root et images multi-architectures publiées sur GHCR. Les scénarios de fonctionnement, de persistance et de publication ont été testés localement.
