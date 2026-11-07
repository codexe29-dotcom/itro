pipeline {
    agent any

    parameters {
        string(
            name: 'COMMIT_ID',
            defaultValue: '',
            description: 'Optional commit ID (overrides BRANCH)'
        )
        choice(
            name: 'BRANCH',
            choices: ['development', 'main'],
            description: 'Branch to release when COMMIT_ID is empty'
        )
        string(
            name: 'STAGING_DEPLOY_HOST',
            defaultValue: '',
            description: 'Required staging SSH host (for example stage-api.example.com)'
        )
        string(
            name: 'STAGING_SSH_USER',
            defaultValue: 'ubuntu',
            description: 'SSH user for the staging host'
        )
        string(
            name: 'STAGING_DEPLOY_PATH',
            defaultValue: '',
            description: 'Required absolute deployment path on the staging host'
        )
        string(
            name: 'STAGING_PM2_APP_NAME',
            defaultValue: '',
            description: 'Required PM2 process name for the staging API'
        )
        string(
            name: 'STAGING_API_URL',
            defaultValue: '',
            description: 'Required staging API base URL, including /api'
        )
        string(
            name: 'STAGING_SITE_URL',
            defaultValue: '',
            description: 'Required staging public website URL'
        )
        booleanParam(
            name: 'RUN_SONARQUBE',
            defaultValue: false,
            description: 'Run SonarQube scan and require its quality gate before staging'
        )
    }

    environment {
        GIT_URL = 'git@github.com:BOSTONHANA/ITRO.git'
        REPO_DIR = 'ITRO'
        PRODUCTION_DEPLOY_HOST = '34.100.132.196'
        PRODUCTION_SSH_USER = 'ubuntu'
        PRODUCTION_DEPLOY_PATH = '/home/ubuntu/ITRO-development'
        PRODUCTION_PM2_APP_NAME = 'itro-api'
        PRODUCTION_API_URL = 'https://itro.co.in/api'
        PRODUCTION_SITE_URL = 'https://itro.co.in'
        SONAR_PROJECT_KEY = 'itro-platform'
        SONAR_HOST_URL = 'http://3.6.251.121:9000'
        SONAR_TOKEN_ID = 'sonarqube_tokan_ITRO'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Resolve Deployment Config') {
            steps {
                script {
                    def required = [
                        STAGING_DEPLOY_HOST: params.STAGING_DEPLOY_HOST,
                        STAGING_SSH_USER: params.STAGING_SSH_USER,
                        STAGING_DEPLOY_PATH: params.STAGING_DEPLOY_PATH,
                        STAGING_PM2_APP_NAME: params.STAGING_PM2_APP_NAME,
                        STAGING_API_URL: params.STAGING_API_URL,
                        STAGING_SITE_URL: params.STAGING_SITE_URL
                    ]
                    def missing = required.findAll { key, value -> !value?.trim() }.keySet()
                    if (!missing.isEmpty()) {
                        error("Staging deployment configuration is required: ${missing.join(', ')}")
                    }

                    if (!(params.STAGING_DEPLOY_HOST ==~ /^[A-Za-z0-9.-]+$/) ||
                        !(params.STAGING_SSH_USER ==~ /^[A-Za-z0-9._-]+$/) ||
                        !(params.STAGING_DEPLOY_PATH ==~ /^\/[A-Za-z0-9._/-]+$/) ||
                        params.STAGING_DEPLOY_PATH.contains('..') ||
                        !(params.STAGING_PM2_APP_NAME ==~ /^[A-Za-z0-9._-]+$/)) {
                        error('Staging host, SSH user, absolute deploy path, or PM2 name contains unsupported characters.')
                    }
                    if (!(params.STAGING_API_URL ==~ /^https?:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:\/[A-Za-z0-9._~-]+)*\/api$/) ||
                        !(params.STAGING_SITE_URL ==~ /^https?:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:\/[A-Za-z0-9._~-]+)*\/?$/)) {
                        error('STAGING_API_URL and STAGING_SITE_URL must be valid HTTP(S) URLs; STAGING_API_URL must end in /api.')
                    }

                    env.DEPLOY_STAGE_HOST = params.STAGING_DEPLOY_HOST
                    env.DEPLOY_STAGE_USER = params.STAGING_SSH_USER
                    env.DEPLOY_STAGE_PATH = params.STAGING_DEPLOY_PATH
                    env.DEPLOY_STAGE_PM2 = params.STAGING_PM2_APP_NAME
                    env.DEPLOY_STAGE_API = params.STAGING_API_URL.replaceAll('/+$', '')
                    env.DEPLOY_STAGE_SITE = params.STAGING_SITE_URL.replaceAll('/+$', '')
                    env.RELEASE_REF = params.COMMIT_ID?.trim() ? params.COMMIT_ID.trim() : "*/${params.BRANCH}"
                    echo "Staging target validated: ${env.DEPLOY_STAGE_USER}@${env.DEPLOY_STAGE_HOST}:${env.DEPLOY_STAGE_PATH}"
                    echo "Production target: ${env.PRODUCTION_SSH_USER}@${env.PRODUCTION_DEPLOY_HOST}:${env.PRODUCTION_DEPLOY_PATH}"
                }
            }
        }

        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: env.RELEASE_REF]],
                    userRemoteConfigs: [[url: env.GIT_URL]]
                ])
                sh 'git rev-parse HEAD'
            }
        }

        stage('Build & Quality Gate') {
            steps {
                sh 'npm ci'
                sh 'npm --workspace server run build'
                sh 'npm --workspace web test'
                sh 'npx playwright install chromium'
                withEnv([
                    "NODE_ENV=production",
                    "VITE_API_URL=${env.DEPLOY_STAGE_API}",
                    "VITE_SITE_URL=${env.DEPLOY_STAGE_SITE}"
                ]) {
                    sh 'npm --workspace web run build'
                }
            }
        }

        stage('SonarQube Scan') {
            when {
                expression { params.RUN_SONARQUBE }
            }
            steps {
                withSonarQubeEnv('sonarqube_ITRO') {
                    withCredentials([string(credentialsId: env.SONAR_TOKEN_ID, variable: 'SONAR_TOKEN')]) {
                        sh '''
                            npx sonar-scanner \
                              -Dsonar.projectKey="$SONAR_PROJECT_KEY" \
                              -Dsonar.sources=server/src,web/src \
                              -Dsonar.host.url="$SONAR_HOST_URL" \
                              -Dsonar.login="$SONAR_TOKEN"
                        '''
                    }
                }
            }
        }

        stage('SonarQube Quality Gate') {
            when {
                expression { params.RUN_SONARQUBE }
            }
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Staging Deployment') {
            steps {
                sh '''
                    ssh "$DEPLOY_STAGE_USER@$DEPLOY_STAGE_HOST" "mkdir -p $DEPLOY_STAGE_PATH/server $DEPLOY_STAGE_PATH/web/dist"
                    rsync -az package.json package-lock.json "$DEPLOY_STAGE_USER@$DEPLOY_STAGE_HOST:$DEPLOY_STAGE_PATH/"
                    rsync -az web/package.json "$DEPLOY_STAGE_USER@$DEPLOY_STAGE_HOST:$DEPLOY_STAGE_PATH/web/"
                    rsync -az --delete \
                      --exclude 'node_modules' --exclude '.env' --exclude 'uploads' --exclude 'public-uploads' \
                      server/ "$DEPLOY_STAGE_USER@$DEPLOY_STAGE_HOST:$DEPLOY_STAGE_PATH/server/"
                    rsync -az --delete web/dist/ "$DEPLOY_STAGE_USER@$DEPLOY_STAGE_HOST:$DEPLOY_STAGE_PATH/web/dist/"
                    ssh "$DEPLOY_STAGE_USER@$DEPLOY_STAGE_HOST" bash -s -- "$DEPLOY_STAGE_PATH" "$DEPLOY_STAGE_PM2" <<'REMOTE_SCRIPT'
set -euo pipefail
DEPLOY_PATH="$1"
PM2_APP_NAME="$2"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1
cd "$DEPLOY_PATH"
npm ci --include=dev
export NODE_ENV=production
node <<'NODE'
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });
const required = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'CORS_ORIGIN', 'PUBLIC_WEB_URL', 'STORAGE_DRIVER', 'S3_BUCKET_NAME', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing staging server configuration: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.STORAGE_DRIVER !== 's3' ||
    process.env.JWT_SECRET.length < 32 ||
    /change-me|replace-with|placeholder/i.test(process.env.JWT_SECRET) ||
    (process.env.S3_ENDPOINT && !process.env.STORAGE_PUBLIC_BASE_URL)) {
  console.error('Staging requires STORAGE_DRIVER=s3, complete S3 settings, and a non-placeholder JWT_SECRET of at least 32 characters.');
  process.exit(1);
}
NODE
cd server
npm run build
npx prisma migrate deploy
pm2 restart "$PM2_APP_NAME" --update-env || pm2 start dist/index.js --name "$PM2_APP_NAME" --update-env
pm2 save
REMOTE_SCRIPT
                '''
            }
        }

        stage('Staging Health Verification') {
            steps {
                sh '''
                    set +e
                    status=$(curl --silent --show-error --location --max-time 15 --retry 10 --retry-connrefused --retry-delay 3 --output /dev/null --write-out '%{http_code}' "$DEPLOY_STAGE_API/health")
                    result=$?
                    set -e
                    if [ "$result" -ne 0 ] || [ "$status" != "200" ]; then
                      echo "Staging health check failed: HTTP $status (curl exit $result)"
                      exit 1
                    fi
                    echo "Staging API health check passed: HTTP $status"
                '''
            }
        }

        stage('Production Approval Gate') {
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: 'Promote staging build to production?', ok: 'Promote'
                }
            }
        }

        stage('Production Deployment') {
            steps {
                withEnv([
                    "NODE_ENV=production",
                    "VITE_API_URL=${env.PRODUCTION_API_URL}",
                    "VITE_SITE_URL=${env.PRODUCTION_SITE_URL}"
                ]) {
                    sh 'npm --workspace web run build'
                }
                archiveArtifacts artifacts: 'package.json,package-lock.json,server/package.json,server/dist/**,server/prisma/migrations/**,web/package.json,web/dist/**',
                    fingerprint: true
                sh '''
                    ssh "$PRODUCTION_SSH_USER@$PRODUCTION_DEPLOY_HOST" "mkdir -p $PRODUCTION_DEPLOY_PATH/server $PRODUCTION_DEPLOY_PATH/web/dist"
                    rsync -az package.json package-lock.json "$PRODUCTION_SSH_USER@$PRODUCTION_DEPLOY_HOST:$PRODUCTION_DEPLOY_PATH/"
                    rsync -az web/package.json "$PRODUCTION_SSH_USER@$PRODUCTION_DEPLOY_HOST:$PRODUCTION_DEPLOY_PATH/web/"
                    rsync -az --delete \
                      --exclude 'node_modules' --exclude '.env' --exclude 'uploads' --exclude 'public-uploads' \
                      server/ "$PRODUCTION_SSH_USER@$PRODUCTION_DEPLOY_HOST:$PRODUCTION_DEPLOY_PATH/server/"
                    rsync -az --delete web/dist/ "$PRODUCTION_SSH_USER@$PRODUCTION_DEPLOY_HOST:$PRODUCTION_DEPLOY_PATH/web/dist/"
                    ssh "$PRODUCTION_SSH_USER@$PRODUCTION_DEPLOY_HOST" bash -s -- "$PRODUCTION_DEPLOY_PATH" "$PRODUCTION_PM2_APP_NAME" <<'REMOTE_SCRIPT'
set -euo pipefail
DEPLOY_PATH="$1"
PM2_APP_NAME="$2"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1
cd "$DEPLOY_PATH"
npm ci --include=dev
export NODE_ENV=production
node <<'NODE'
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });
const missing = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'CORS_ORIGIN', 'PUBLIC_WEB_URL', 'STORAGE_DRIVER', 'S3_BUCKET_NAME', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
  .filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing production server configuration: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.STORAGE_DRIVER !== 's3' ||
    process.env.JWT_SECRET.length < 32 ||
    /change-me|replace-with|placeholder/i.test(process.env.JWT_SECRET) ||
    (process.env.S3_ENDPOINT && !process.env.STORAGE_PUBLIC_BASE_URL)) {
  console.error('Production requires STORAGE_DRIVER=s3, complete S3 settings, and a non-placeholder JWT_SECRET of at least 32 characters.');
  process.exit(1);
}
NODE
cd server
npm run build
npx prisma migrate deploy
pm2 restart "$PM2_APP_NAME" --update-env || pm2 start dist/index.js --name "$PM2_APP_NAME" --update-env
pm2 save
REMOTE_SCRIPT
                '''
            }
        }

        stage('Production Health Verification') {
            steps {
                sh '''
                    set +e
                    status=$(curl --silent --show-error --location --max-time 15 --retry 10 --retry-connrefused --retry-delay 3 --output /dev/null --write-out '%{http_code}' "$PRODUCTION_API_URL/health")
                    result=$?
                    set -e
                    if [ "$result" -ne 0 ] || [ "$status" != "200" ]; then
                      echo "Production health check failed: HTTP $status (curl exit $result)"
                      exit 1
                    fi
                    echo "Production API health check passed: HTTP $status"
                '''
            }
        }
    }

    post {
        success {
            echo "Staging verified and production deployment succeeded — ref=${env.RELEASE_REF}"
        }
        failure {
            echo 'Deployment pipeline failed. Review the failing stage before retrying or restoring the previous release.'
        }
        aborted {
            echo 'Deployment pipeline was aborted; production may not have been promoted.'
        }
    }
}
