mod utils;

use wasm_bindgen::prelude::*;
use sqlparser::dialect::*; // Import all the dialects you are using
use sqlparser::tokenizer::*; // Import the tokenizer
use serde_wasm_bindgen::to_value;
use std::panic;

#[wasm_bindgen]
pub fn tokenize(dialect_name: &str, sql: &str) -> Result<JsValue, JsValue> {
    panic::set_hook(Box::new(console_error_panic_hook::hook));

    let dialect: Box<dyn Dialect> = match dialect_name {
        "ansi" => Box::new(AnsiDialect {}),
        "bigquery" => Box::new(BigQueryDialect {}),
        "postgres" => Box::new(PostgreSqlDialect {}),
        "ms" => Box::new(MsSqlDialect {}),
        "mysql" => Box::new(MySqlDialect {}),
        "snowflake" => Box::new(SnowflakeDialect {}),
        "hive" => Box::new(HiveDialect {}),
        "redshift" => Box::new(RedshiftSqlDialect {}),
        "clickhouse" => Box::new(ClickHouseDialect {}),
        "duckdb" => Box::new(DuckDbDialect {}),
        "sqlite" => Box::new(SQLiteDialect {}),
        "generic" | "" => Box::new(GenericDialect {}),
        s => return Err(JsValue::from_str(&format!("Unexpected dialect: {}", s))),
    };

    let mut tokenizer = Tokenizer::new(dialect.as_ref(), sql).with_unescape(false);

    let tokens = tokenizer.tokenize()
        .map_err(|e| JsValue::from_str(&format!("Tokenization error: {}", e)))?;

    to_value(&tokens).map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
