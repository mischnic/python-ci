# python-ci

A lightweight CI-server written in python, originally developed for a Raspberry Pi homeserver because other existing solutions were to resource-intensive (Jenkins) or cumbersome to use.

Currently it only support LaTeX files, but you can easily add another language in [python-ci.py](python-ci.py) (see `if lang == "latex":`) to do whatever you want!

## Setup

Put your source folder next to the script (see below) and make `start.sh` executable (rename it to start.sh if you wish).

You need the following file hierarchy:

	python-ci
	 |- python-ci.py
	 |- README.md
	 |- Maths
	 |  - .ci.yml
	 |  - Document.tex
	  - Maths_build
	    |- Document.pdf
	    |- Document.aux
	     - ...
		 

`.ci.yml` is the project's configuration file:

	language: latex
	main: Document

(Currently only `latex` is implemented.)

## Usage

python-ci delivers the following pages:
- http://ci.example.com/?ref=1a2b3c5
  
  GET request alternative to a GitHub webhook, accepts long and short commit-hash
- http://ci.example.com/output.pdf

  Corresponds to the file Maths_build/Document.pdf (again, with the default configuration)
- http://ci.example.com/output.log

  Returns the compile-log which was saved as Maths_build/_Document.log
- http://ci.example.com/output.svg

  ![badge example](example_badge.svg) Returns a svg-badge indicating the commit-hash of the last build and the build status (successful, error, currently running)
  Example to have a badge which links to the log file:
  
  `[![build status](http://ci.example.com/output.svg)](http://ci.example.com/output.log)`

## As a GitHub webhook

When adding the webhook, be sure to set the "Content type" to `application/json` in the GitHub web-interface.

## Server configuration

By default, python-ci listens on `localhost:8000`, meaning that it will only accept connections from the server itself. To reach it anyway you could something like this in your nginx configuration to accept requests from the `ci` subdomain:


	server {
		listen 80;
	
		# listen 443 ssl;
		# ssl_certificate ...
	
		server_name	ci.example.com;
	
		location / {
			proxy_pass http://localhost:8000;
		}
	}

If your router doesn't support [NAT loopback](https://en.wikipedia.org/wiki/NAT_loopback) alias [Hairpinning](https://en.wikipedia.org/wiki/Hairpinning) (meaning that trying to access `ci.example.com` in the same network as the server causes a `ERR_CONNECTION_REFUSED`) then you have to add `ci.example.com*` to the `server_name` directive. This enables you to access the server under `ci.example.com.192.168.0.2.nip.io` with `192.168.0.2` being the IP of the server in your local network.

