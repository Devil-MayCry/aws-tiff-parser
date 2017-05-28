# start docker and run the service bash script to run the service
chmod 777 /home/huteng/www/gdal-tiff-sentinel-aws/bin/start_from_docker.sh

docker run -it -v /home/huteng/www/gdal-tiff-sentinel-aws/:/usr/local/gdal-tiff-sentinel-aws/ -v /home/ec2-user/s3-gagobucket/tiles:/home/ec2-user/s3-gagobucket/tiles -v /home/ec2-user/s3-sentinel-2/tiles/:/home/ec2-user/s3-sentinel-2/tiles/ docker.gagogroup.cn:5000/gdal:latest sh /usr/local/gdal-tiff-sentinel-aws/bin/start_from_docker.sh