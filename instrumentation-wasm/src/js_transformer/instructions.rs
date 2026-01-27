use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInstructions {
    pub path: String,
    pub identifier: String,
    pub version_range: String,
    pub functions: Vec<FunctionInstructions>,
    pub access_local_variables: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionInstructions {
    pub node_type: String,
    pub name: String,
    pub identifier: String,
    pub inspect_args: bool,
    pub modify_args: bool,
    pub modify_return_value: bool,
    pub modify_arguments_object: bool,
}
