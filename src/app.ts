import {TiffTilerService} from "./tifftiler/tifftilerservice";

TiffTilerService.startTransformImageToTiff(2017, 5, 8, ["B01", "B02"]);
console.log("Server start");