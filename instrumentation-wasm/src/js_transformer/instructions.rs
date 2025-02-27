use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInstructions {
    pub path: String,
    pub functions: Vec<FunctionInstructions>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionInstructions {
    pub node_type: String,
    pub name: String,
    pub inspect_args: bool,
    pub modify_return_value: bool,
}
