#!/usr/bin/env bash

#
# This script will grow over time to support a proper staged site leveraging local ui build. 
#
 
function usage() {
  echo "Usage: ";
  echo " ./jetty-website.sh [command]";
  echo "   settings : print configured settings";
  echo "   stage : stage the latest version of the website for review";
  echo "   release : deploy the latest version of the website";
  echo "";
}

function set_global_variables() {

  ##
  ## Update these settings accordingly
  ##
  STAGE_DIR=$(pwd)/target/stage
  RELEASE_DIR=$(pwd)/target/release

  MIN_JAVA_VERSION=17
  MIN_MAVEN_VERION=3.9.4
  SCRIPT_OUTPUT_DIR="$(pwd)/target";
  BUILT_SITE_DIR=$(pwd)/target/site;
  LOG_FILE="$SCRIPT_OUTPUT_DIR/jetty-website.log";
}

function print_settings() {
  echo "Staging Directory: $STAGE_DIR";
  echo "Release Directory: $RELEASE_DIR";
  echo "Log File: $LOG_FILE";
}

function check_environment() {

  echo "$FUNCNAME";
  # check java
  if [[ -z "${JAVA_HOME}" ]]; then
    echo "Error: JAVA_HOME environment variable not set, required for javadoc generation."
    exit 1
  fi

  local java_version=$(java -version 2>&1 | head -n1 | sed -r 's/.*version "([0-9]*).*$/\1/');

  if [[ $java_version < $MIN_JAVA_VERSION ]]; then
    echo "Error: java version must be $MIN_JAVA_VERSION+";
  fi

  # check maven
  local maven_version=$(mvn -version 2>&1 | head -n1 | sed -r 's/.*Maven ([0-9.]*).([0-9]*).([0-9]*).*$/\1\2\3/');
  
  if [[ $maven_version < $MIN_MAVEN_VERSION ]]; then
    echo "Error: mvn version must be $MIN_MAVEN_VERSION+";
  fi
}

function set_environment() {
  echo "$FUNCNAME";

  set_global_variables;
  set_log_file;

}

function set_log_file() {
  echo "$FUNCNAME";

  if [[ -e "$LOG_FILE" ]]; then
    rm $LOG_FILE;
  fi
  mkdir -p $SCRIPT_OUTPUT_DIR;
  touch $LOG_FILE;
}

# maybe we shouldn't bother with this, just pull from the published ui github action artifact
# though if we are staging we should build and use that artifact
function build_ui() {
  echo "$FUNCNAME";

  local owd=$(pwd);

  cd ui;

  echo " - building ui";
  mvn process-resources &>>"$LOG_FILE";
  local mvn_status=$?;

  if [[ mvn_status -ne 0 ]]; then
    echo " - error building ui";
    exit 1;
  fi

  cd $owd;
}

function copy_files() {
  local from_dir=$1;
  local to_dir=$2;

  echo "    - copying files from $from_dir to $to_dir";
  rsync -avh $from_dir $to_dir &>> $LOG_FILE;

}

function build_site() {
  echo "$FUNCNAME";

  echo " - building site";
  echo "   - this may take up to 10 minutes";
  echo "   - Follow: tail -f $LOG_FILE";
  mvn antora &>>"$LOG_FILE";
  local mvn_status=$?;

  if [[ mvn_status -ne 0 ]]; then
    echo " - error building site";
    exit 1;
  fi

  if [[ ! -f "$$BUILT_SITE_DIR/index.html" ]]; then
    echo " - successfully built website";
  else
    echo " - error building website, no index.html";
    exit 1;
  fi

}

function deploy_site() {
  echo "$FUNCNAME";

  local site_dir=$BUILT_SITE_DIR;
  local deploy_dir=$1;

  if [[ ! -d "$site_dir" ]]; then
    echo " - error, no files to deploy in $site_dir";
    exit 1;
  fi

  if [[ ! -d "$deploy_dir" ]]; then
    echo " - creating deployment directory"
    mkdir -p $deploy_dir;
  fi

  echo " - deploying site to $deploy_dir";

  copy_files "$BUILT_SITE_DIR/" $deploy_dir;

  echo " - site deployed";
}


function main() {
  echo "$FUNCNAME in $0";
  local directive=$1;

  if [[ $directive == "settings" ]]; then
    check_environment;
    set_environment;
    print_settings;
    exit 0;
  fi

  if [[ $directive == "stage" ]]; then
    check_environment;
    set_environment;
    build_site;
    deploy_site "$STAGE_DIR";
    exit 0;
  fi

  if [[ $directive == "release" ]]; then
    check_environment;
    set_environment;
    build_site;
    deploy_site "$RELEASE_DIR";

    exit 0;
  fi

  # print usage
  usage;
  exit 0;
}

main $1;
