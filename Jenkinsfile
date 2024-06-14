#!groovy

pipeline {
  agent any
  // save some io during the build
  options { durabilityHint( 'PERFORMANCE_OPTIMIZED' ) }
  stages {
    stage( "Build Website" ) {
      agent { node { label 'linux' } }
      steps {
        timeout( time: 120, unit: 'MINUTES' ) {
          withMaven( maven: 'maven3', jdk: 'jdk17' ) {
            sh "bash ./jetty-website.sh --follow-log --directive stage"
          }
        }
      }
    }
  }
}
// vim: et:ts=2:sw=2:ft=groovy
