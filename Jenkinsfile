pipeline {
    agent any
   // agent { 
   //    label 'jenkins' 
   //     }
    
    environment {
        AWS_REGION = 'ap-south-1'
        ECS_CLUSTER_NAME = 'vtalix-Dev'
        ECR_REPO_URL = '396913745392.dkr.ecr.ap-south-1.amazonaws.com/v2-video-service-dev'
        DOCKER_IMAGE_NAME = 'v2-video-service-dev'
        SERVICE_NAME    = 'v2-video-service'
        TASK_DEFINITION_NAME = 'v2-video-service-dev'
        GITHUB_BRANCH = 'features/mysql'
        TASK_DEFINITION_FILE = 'ecs/taskDefinition.json'  
        ENV = 'dev'
        ENVIRONMENT = 'dev'
    }
    
    // Define AWS credentials for ECS access
//    credentials {
//        string(name: 'AWS_ACCESS_KEY_ID', value: credentials('awssecretkey').accessKeyId)
//        string(name: 'AWS_SECRET_ACCESS_KEY', value: credentials('awssecretkey').secretAccessKey)
//    }

    stages {
        stage('Checkout Code') {
            steps {
                // Checkout code from GitHub repository and specific branch
                git branch: "${GITHUB_BRANCH}", credentialsId: 'githubtoken', url: 'https://github.com/Vtalix/v2__video__repo.git'
            }
        }
        stage('Copy Environment Variables') {
            steps {
                script {
                    // Use AWS CLI to copy the environment file from S3
                    sh '''
                    aws s3 cp s3://vtalix-env/${ENV}/${ENV}.env .env
                    '''
                }
            }
        }


        stage('Docker Build') {
            steps {
                script {
                    // Log into AWS ECR
                    sh """
                    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO_URL}
                    """
                    // Build the Docker image
                    sh """
                    docker build -t ${DOCKER_IMAGE_NAME}:latest .
                    """
                }
            }
        }

        stage('Tag Docker Image') {
            steps {
                script {
                    // Tag the Docker image with the ECR repository name
                    sh """
                    docker tag ${DOCKER_IMAGE_NAME}:latest ${ECR_REPO_URL}:latest
                    """
                }
            }
        }

        stage('Push Docker Image to ECR') {
            steps {
                script {
                    // Push the Docker image to Amazon ECR
                    sh """
                    docker push ${ECR_REPO_URL}:latest
                    """
                }
            }
        }



        stage('Update ECS Service') {
            steps {
                script {
                    // Update the ECS service to use the new task definition
                    sh """
                    aws ecs update-service --cluster ${ECS_CLUSTER_NAME} --service ${SERVICE_NAME} --force-new-deployment --task-definition ${TASK_DEFINITION_NAME} --region ${AWS_REGION}
                    """
                }
            }
        }
    }

//    post {
 //       always {
            // Clean up Docker images (optional)
 //           sh """
  //          docker system prune -af
  //          """
  //      }
 //   }
}
