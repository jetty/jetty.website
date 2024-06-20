#!/bin/bash
#set -x

#
# This script will grow over time to support a proper staged site leveraging local ui build. 
#
 
function usage() {
  echo "Usage: ";
  echo " ./jetty-website.sh [options]";
  echo "    -s,--stage-dir: directory to stage build website"
  echo "    -r,--release-dir: directory to release build website"
  echo "    -f,--follow-log: to have logs in the console"
  echo "    -u,--user-sudo: User to use for sudo copy"
  echo "    -d,--directive: directive to use"
  echo "          settings : print configured settings";
  echo "          stage : stage the latest version of the website for review";
  echo "          release : deploy the latest version of the website";
  echo "    -h,--help: display help information"
  echo "";

  SHORT=s:r:fd:h
  LONG=stage-dir,release-dir:,follow-log,directive:,help

}

function print_settings() {
  echo "Staging Directory: $STAGE_DIR";
  echo "Release Directory: $RELEASE_DIR";
  echo "SUDO_USER: $SUDO_USER";
  echo "Log File: $LOG_FILE";
  echo "follow logs: $FOLLOW_LOGS"
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
    echo "Error: java version $java_version must be $MIN_JAVA_VERSION+";
  fi

  # check maven
  local maven_version=$(./mvnw -version 2>&1 | head -n1 | sed -r 's/.*Maven ([0-9.]*).([0-9]*).([0-9]*).*$/\1\2\3/');
  
  if [[ $maven_version < $MIN_MAVEN_VERSION ]]; then
    echo "Error: mvn version must be $MIN_MAVEN_VERSION+";
  fi
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

  if [ ! -z "$SUDO_USER" ]; then 
    echo "    - copying files from $from_dir to $to_dir as user $SUDO_USER";
    run_cmd "sudo -u $SUDO_USER rsync -avh --delete --checksum $from_dir $to_dir"
  else 
    echo "    - copying files from $from_dir to $to_dir";
    run_cmd "rsync -avh --delete --checksum $from_dir $to_dir"
  fi
  local rsync_status=$?;

  if [[ rsync_status -ne 0 ]]; then
    echo " - error deploying site";
    exit 1;
  fi

}

function compress_files() {
  local directory=$1;
  echo "$FUNCNAME";

  for extension in ${COMPRESS_EXTENSIONS[@]}; do
    #echo "processing $extension";
    find $directory -type f -name $extension -print0 | while IFS= read -r -d '' file; do
      #echo "compressing $file";
      if [[ ! -e $file.gz ]]; then
        gzip -9 -k $file;
      fi
    done
  done
}

function init_site() {
  echo "$FUNCNAME";

  echo " - building site";
  echo "   - this may take up to 10+ minutes";

  run_cmd "./mvnw -B -e -V -ntp -Dorg.slf4j.simpleLogger.showDateTime=true -Dorg.slf4j.simpleLogger.dateTimeFormat=HH:mm:ss antora:antora@full";
  local mvn_status=$?;

  if [[ mvn_status -ne 0 ]]; then
    echo " - error building site";
    exit 1;
  fi

}

function build_ui() {
  echo "$FUNCNAME";

  echo " - building ui";
  echo "   - this may take up 5 minutes";
  echo "   - Follow: tail -f $LOG_FILE";

  cd ui;  
  run_cmd "./mvnw -B -e -V -ntp -Dorg.slf4j.simpleLogger.showDateTime=true -Dorg.slf4j.simpleLogger.dateTimeFormat=HH:mm:ss process-resources"
  local mvn_status=$?;
  cd ..;

  if [[ mvn_status -ne 0 ]]; then
    echo " - error building ui";
    exit 1;
  fi

  if [[ ! -f "$UI_BUNDLE_FILE" ]]; then
    echo " - successfully built website";
  else
    echo " - error building website, no index.html";
    exit 1;
  fi

}

function build_site() {
  echo "$FUNCNAME";

  echo " - building site";
  echo "   - this may take up to 10 minutes";

  run_cmd "./mvnw -B -e -V -ntp -Dorg.slf4j.simpleLogger.showDateTime=true -Dorg.slf4j.simpleLogger.dateTimeFormat=HH:mm:ss antora:antora@full"
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

function run_cmd() {
  if [[ "$FOLLOW_LOGS" == "true" ]]; then
    eval "$1";
  else
    echo "   - Follow: tail -f $LOG_FILE";
    eval "$1 &>> $LOG_FILE";
  fi
}

function main() {

  local directive=$DIRECTIVE

  if [[ $directive == "settings" ]]; then
    check_environment;
    print_settings;
    exit 0;
  fi

  if [[ $directive == "stage" ]]; then
    check_environment;
    #build_ui;
    build_site;
    compress_files "target/site/_" #TODO choose dir better
    deploy_site "$STAGE_DIR";
    exit 0;
  fi

  if [[ $directive == "release" ]]; then
    check_environment;
    build_site;
    compress_files "target/site/_"
    deploy_site "$RELEASE_DIR";

    exit 0;
  fi

  if [[ $directive == "compress" ]]; then
    check_environment;
    compress_files "target/site/_";
  fi

  # print usage
  usage;
  exit 0;
}


function set_environment() {
  echo "$FUNCNAME";

  set_global_variables;
  set_log_file;
}


function set_global_variables() {
  ##
  ## Update these settings accordingly
  ##
  SUDO_USER=www-data
  STAGE_DIR=$(pwd)/target/stage;
  RELEASE_DIR=$(pwd)/target/release;
  COMPRESS_EXTENSIONS=("*.woff" "*.woff2" "*.js" "*.css" "*.svg");

  export CI=true
  MIN_JAVA_VERSION=17
  MIN_MAVEN_VERION=3.9.4
  SCRIPT_OUTPUT_DIR="$(pwd)/target";
  BUILT_SITE_DIR=$(pwd)/target/site;
  UI_BUNDLE_FILE="$(pwd)/ui/build/ui-bundle.zip"
  LOG_FILE="$SCRIPT_OUTPUT_DIR/jetty-website.log";
  FOLLOW_LOGS=false
}

set_environment

# Parse command-line options
# Option strings
SHORT=s:r:fd:hu:
LONG=stage-dir,release-dir:,follow-log,directive:,help,user-sudo:
# read the options
OPTS=$(getopt --options $SHORT --long $LONG --name "$0" -- "$@")
if [ $? != 0 ] ; then echo "Failed to parse options...exiting." >&2 ; exit 1 ; fi
eval set -- "$OPTS"
while true; do
  case "$1" in
      -s | --stage-dir )
          STAGE_DIR=$2
          shift 2
          ;;
      -r | --release-dir )
          RELEASE_DIR=$2
          shift 2
          ;;
      -f | --follow-log )
          FOLLOW_LOGS=true
          shift
          ;;
      -h | --help )
          HELP=true
          shift
          ;;
      -d | --directive )
          DIRECTIVE=$2
          shift 2
          ;;
      -u | --user-sudo )
          SUDO_USER=$2
          shift 2
          ;;
      -- )
          shift
          break
          ;;
  esac
done

if [[ "$HELP" == "true" ]]; then
  usage
  exit 0
fi

main;
