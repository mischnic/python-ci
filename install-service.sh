#!/usr/bin/env bash

if [[ $EUID -eq 0 ]]; then
   echo "This script must not be run as root" 1>&2
   exit 1
fi

yellow=`tput setaf 3`
reset=`tput sgr0`

echo  "This script will need to ask for your password to install the systemd service, these commands will be shown in yellow"

echo "${yellow}systemctl stop python-ci${reset}"
sudo systemctl stop python-ci > /dev/null 2>&1

sed -e "s#?DIR?#${PWD}#g; s#?USER?#$(whoami)#g" python-ci.service.in > python-ci.service

echo "${yellow}mv python-ci.service /etc/systemd/system/python-ci.service${reset}"
sudo mv python-ci.service /etc/systemd/system/python-ci.service

echo "${yellow}systemctl daemon-reload${reset}"
sudo systemctl daemon-reload

echo "${yellow}systemctl enable python-ci${reset}"
sudo systemctl enable python-ci
