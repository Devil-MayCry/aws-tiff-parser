import {TiffTilerService} from "./tifftiler/tifftilerservice";

TiffTilerService.startTransformImageToTiff(2017, 5, 8, ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08"]);
console.log("Server start");