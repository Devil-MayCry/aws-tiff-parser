# start docker and run the service bash script to run the service

docker run -dit -v /home/ec2-user/s3-gagobucket/:/home/ec2-user/s3-gagobucket/ -v /home/ec2-user/s3-sentinel-2/tiles/:/home/ec2-user/s3-sentinel-2/tiles/ docker.gagogroup.cn:5000/gdal-tiff-sentinel-aws:latest /usr/local/gdal-tiff-sentinel-aws/bin/start_from_docker.sh