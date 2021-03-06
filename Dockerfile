FROM docker.gagogroup.cn:5000/gdal-tiff-sentinel-aws



# Add all files to /usr/local/image-browser-aws/
WORKDIR /usr/local/
RUN rm -rf gdal-tiff-sentinel-aws/
RUN mkdir gdal-tiff-sentinel-aws/
ADD . gdal-tiff-sentinel-aws/

# Build
WORKDIR /usr/local/gdal-tiff-sentinel-aws/
RUN sh bin/build.sh

# Just make sure that we are in the right permission
RUN chmod 777 bin/start_from_docker.sh
