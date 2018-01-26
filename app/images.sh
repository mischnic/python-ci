#!/usr/bin/env sh

resize(){
	name=$1

	convert ${name}.png -resize 192x192 icon_192.png
	convert ${name}.png -resize 256x256 icon_256.png
	convert ${name}.png -resize 384x384 icon_384.png
	convert ${name}.png -resize 512x512 icon_512.png
}

resize icon
