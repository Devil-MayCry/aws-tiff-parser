#!/usr/bin/env bash
read -p "Current VERSION is ? (0.1.0):" VERSION


# build image from docker file
docker build -t docker.gagogroup.cn:5000/gdal-tiff-sentinel-aws:${VERSION} -t docker.gagogroup.cn:5000/gdal-tiff-sentinel-aws:latest .

# push them
docker push docker.gagogroup.cn:5000/gdal-tiff-sentinel-aws:${VERSION}
docker push docker.gagogroup.cn:5000/gdal-tiff-sentinel-aws:latest
