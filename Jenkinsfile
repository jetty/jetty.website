#!groovy

pipeline {
  agent any
  // save some io during the build
  options {
    durabilityHint( 'PERFORMANCE_OPTIMIZED' )
    buildDiscarder logRotator( numToKeepStr: '15' )
  }
  stages {
    stage( "Build Website" ) {
      agent { node { label 'linux' } }
      steps {
        timeout( time: 120, unit: 'MINUTES' ) {
          withEnv(["JAVA_HOME=${tool 'jdk21'}",
                   "PATH+MAVEN=${env.JAVA_HOME}/bin:${tool 'maven3'}/bin",
                   "MAVEN_OPTS=-Xms2g -Xmx4g -Djava.awt.headless=true"]) {
            sh "bash ./jetty-website.sh --follow-log --user-sudo jenkins --directive stage -u ''"
            publishHTML (target : [allowMissing: false,
                                   alwaysLinkToLastBuild: true,
                                   keepAll: true,
                                   reportDir: 'target/stage',
                                   reportFiles: 'index.html',
                                   reportName: 'Jetty site',
                                   reportTitles: 'Jetty site'])
          }
        }
      }
    }
  }
}
// vim: et:ts=2:sw=2:ft=groovy
