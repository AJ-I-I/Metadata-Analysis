// TO DO
// [ ] Make sure project is running
// [ ] basic debug of version 1
// [ ] once debug is succesful push to main
// [ ] Complete basic testing (i.e. does it work?)
// [ ] complete-test-set 1
// [ ] implement reverse image search
// [ ] stress/edge case testing

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use exif::{Reader, Tag, In};
use std::io::Cursor;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub date_taken: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub gps_altitude: Option<f64>,
    pub software: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub orientation: Option<u16>,
    pub iso: Option<u32>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub focal_length: Option<String>,
    pub all_fields: Vec<MetadataField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataField {
    pub tag: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisOptions {
    pub extract_metadata: bool,
    pub reverse_image_search: bool,
    pub plot_coordinates: bool,
}

#[wasm_bindgen]
pub struct ImageAnalyzer {
    metadata: Option<ImageMetadata>,
}

#[wasm_bindgen]
impl ImageAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ImageAnalyzer {
        ImageAnalyzer { metadata: None }
    }

    #[wasm_bindgen]
    pub fn analyze_image(&mut self, image_data: &[u8], options: JsValue) -> Result<JsValue, JsValue> {
        console_log!("Starting image analysis...");
        
        let options: AnalysisOptions = serde_wasm_bindgen::from_value(options)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse options: {}", e)))?;

        let mut metadata = ImageMetadata {
            camera_make: None,
            camera_model: None,
            date_taken: None,
            gps_latitude: None,
            gps_longitude: None,
            gps_altitude: None,
            software: None,
            width: None,
            height: None,
            orientation: None,
            iso: None,
            exposure_time: None,
            f_number: None,
            focal_length: None,
            all_fields: Vec::new(),
        };

        if options.extract_metadata {
            console_log!("Extracting metadata...");
            self.extract_metadata(image_data, &mut metadata)?;
        }

        self.metadata = Some(metadata.clone());

        Ok(serde_wasm_bindgen::to_value(&metadata)?)
    }

    fn extract_metadata(&self, image_data: &[u8], metadata: &mut ImageMetadata) -> Result<(), JsValue> {
        // Get image dimensions
        if let Ok(img) = image::load_from_memory(image_data) {
            metadata.width = Some(img.width());
            metadata.height = Some(img.height());
        }

        // Extract EXIF data
        let mut cursor = Cursor::new(image_data);
        let reader = Reader::new();
        
        match reader.read_from_container(&mut cursor) {
            Ok(exif_data) => {
                for field in exif_data.fields() {
                    let tag_name = format!("{:?}", field.tag);
                    let value = format!("{}", field.display_value().with_unit(&exif_data));
                    
                    metadata.all_fields.push(MetadataField {
                        tag: tag_name.clone(),
                        value: value.clone(),
                    });

                    match field.tag {
                        Tag::Make => {
                            metadata.camera_make = Some(value);
                        }
                        Tag::Model => {
                            metadata.camera_model = Some(value);
                        }
                        Tag::DateTime | Tag::DateTimeOriginal | Tag::DateTimeDigitized => {
                            if metadata.date_taken.is_none() {
                                metadata.date_taken = Some(value);
                            }
                        }
                        Tag::Software => {
                            metadata.software = Some(value);
                        }
                        Tag::Orientation => {
                            if let In::PRIMARY = field.ifd_num {
                                if let Some(orientation) = field.value.get_uint(0) {
                                    metadata.orientation = Some(orientation as u16);
                                }
                            }
                        }
                        Tag::ISOSpeed => {
                            if let Some(iso) = field.value.get_uint(0) {
                                metadata.iso = Some(iso as u32);
                            }
                        }
                        Tag::ExposureTime => {
                            metadata.exposure_time = Some(value);
                        }
                        Tag::FNumber => {
                            metadata.f_number = Some(value);
                        }
                        Tag::FocalLength => {
                            metadata.focal_length = Some(value);
                        }
                        Tag::GPSLatitude => {
                            // GPS coordinates are handled in the GPS IFD section below
                        }
                        Tag::GPSLongitude => {
                            // GPS coordinates are handled in the GPS IFD section below
                        }
                        Tag::GPSAltitude => {
                            if let exif::Value::Rational(ref rationals) = field.value {
                                if !rationals.is_empty() {
                                    metadata.gps_altitude = Some(rationals[0].to_f64());
                                }
                            }
                        }
                        _ => {}
                    }
                }

                // Try to get GPS coordinates from GPS IFD
                if metadata.gps_latitude.is_none() || metadata.gps_longitude.is_none() {
                    if let Some(gps_lat) = exif_data.get_field(Tag::GPSLatitude, In::PRIMARY) {
                        if let Some(gps_lat_ref) = exif_data.get_field(Tag::GPSLatitudeRef, In::PRIMARY) {
                            if let Some(gps_lon) = exif_data.get_field(Tag::GPSLongitude, In::PRIMARY) {
                                if let Some(gps_lon_ref) = exif_data.get_field(Tag::GPSLongitudeRef, In::PRIMARY) {
                                    let lat = Self::parse_gps_coordinate(gps_lat, gps_lat_ref);
                                    let lon = Self::parse_gps_coordinate(gps_lon, gps_lon_ref);
                                    
                                    if let (Some(lat_val), Some(lon_val)) = (lat, lon) {
                                        metadata.gps_latitude = Some(lat_val);
                                        metadata.gps_longitude = Some(lon_val);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(_) => {
                console_log!("No EXIF data found in image");
            }
        }

        Ok(())
    }

    fn parse_gps_coordinate(coord_field: &exif::Field, ref_field: &exif::Field) -> Option<f64> {
        let ref_str = ref_field.display_value().to_string();
        let is_negative = ref_str == "S" || ref_str == "W";

        // kamadak-exif uses Rational values for GPS coordinates
        if let exif::Value::Rational(ref rationals) = coord_field.value {
            if rationals.len() >= 3 {
                let degrees = rationals[0].to_f64();
                let minutes = rationals[1].to_f64();
                let seconds = rationals[2].to_f64();
                let decimal = degrees + minutes / 60.0 + seconds / 3600.0;
                return Some(if is_negative { -decimal } else { decimal });
            }
        }
        None
    }

    #[wasm_bindgen]
    pub fn get_metadata(&self) -> Result<JsValue, JsValue> {
        match &self.metadata {
            Some(meta) => Ok(serde_wasm_bindgen::to_value(meta)?),
            None => Err(JsValue::from_str("No metadata available")),
        }
    }

    #[wasm_bindgen]
    pub fn reverse_image_search(&self, _image_data: &[u8]) -> Result<JsValue, JsValue> {
        console_log!("Reverse image search not yet implemented - would require API integration");
        // This would typically call an external API like Google Images, TinEye, etc.
        // For now, return empty result
        Ok(serde_wasm_bindgen::to_value(&serde_json::json!({
            "status": "not_implemented",
            "message": "Reverse image search requires external API integration"
        }))?)
    }
}

