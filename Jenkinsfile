// Jenkinsfile
pipeline {
    agent any

    environment {
        SERVICE_NAME = "ton-service"
        DOCKER_IMAGE = "ton-dockerhub/ton-service"
        DOCKER_TAG   = "${env.BUILD_NUMBER}"
        SONAR_TOKEN  = credentials('sonar-token')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Tests') {
            steps {
                sh 'npm test -- --coverage'
            }
        }

        stage('SonarQube') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh """
                        sonar-scanner \
                          -Dsonar.projectKey=${SERVICE_NAME} \
                          -Dsonar.login=${SONAR_TOKEN}
                    """
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
            }
        }

        stage('Push Image') {
            when { branch 'main' }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh "echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin"
                    sh "docker push ${DOCKER_IMAGE}:${DOCKER_TAG}"
                }
            }
        }

        stage('Deploy') {
            when { branch 'main' }
            steps {
                sh """
                    docker stop ${SERVICE_NAME} || true
                    docker rm ${SERVICE_NAME}   || true
                    docker run -d \
                      --name ${SERVICE_NAME} \
                      -p 3000:3000 \
                      ${DOCKER_IMAGE}:${DOCKER_TAG}
                """
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline réussi !"
        }
        failure {
            echo "❌ Pipeline échoué"
        }
        always {
            sh "docker image prune -f"
        }
    }
}

