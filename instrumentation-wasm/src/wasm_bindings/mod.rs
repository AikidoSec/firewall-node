use wasm_bindgen::prelude::*;

use crate::js_transformer::transformer::transform_code_str;

#[wasm_bindgen]
pub fn wasm_transform_code_str(code: &str, instructions_json: &str, source_type: i32) -> String {
    return transform_code_str(code, instructions_json, source_type);
}
