pipeline {
    agent any
    environment {
        PROJECT_KEY = "linear-customer-views"
        DOCKER_REPO = "yourdockerrepo.com/${PROJECT_KEY}"
        DOCKER_CREDENTIALS_ID = "nexus"
        GITHUB_CREDENTIALS_ID = 'github'
        SERVICE_HOOK_URL = 'https://portainer.xxx.com/api/webhooks/xxx.asd'
    }
    stages {
        stage('Git Clone') {
            steps {
                git url: 'https://github.com/feyyazcankose/linear-customer-views', branch: 'main'
            }
        }
        stage('BUILD') {
            steps {
                script {
                   docker.build("${env.DOCKER_REPO}:${env.BUILD_ID}")
                }
            }
        }
        stage('TAG') {
            steps {
                sh "docker tag ${env.DOCKER_REPO}:${env.BUILD_ID} ${env.DOCKER_REPO}:latest"
            }
        }
        stage('PUSH') {
            steps {
                script {
                    docker.withRegistry("http://${env.DOCKER_REPO}", "${env.DOCKER_CREDENTIALS_ID}") {
                        docker.image("${env.DOCKER_REPO}:${env.BUILD_ID}").push()
                        docker.image("${env.DOCKER_REPO}:latest").push()
                    }
                }
            }
        }
        stage('DEPLOY') {
            steps {
                script {
                    // Your deploy script
                }
            }
        }
        stage('CLEANUP') {
            steps {
                script {
                    sh "docker rmi ${env.DOCKER_REPO}:${env.BUILD_ID}"
                    sh "docker rmi ${env.DOCKER_REPO}:latest"
                }
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}
