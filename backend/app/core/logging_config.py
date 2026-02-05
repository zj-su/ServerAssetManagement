# -*- coding: utf-8 -*-
"""
IDC资产管理 - 日志配置
本地环境：同时输出到控制台和日志文件，便于分析
"""
import logging
import os
import sys
from pathlib import Path


# 默认日志目录：项目根目录/logs（IDC项目/logs），若不存在则创建
def _get_log_dir() -> Path:
    # __file__ -> backend/app/core -> backend/app -> backend -> 项目根目录(IDC项目)
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    log_dir = project_root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def _log_file_path() -> Path:
    return _get_log_dir() / "idc_asset.log"


# 统一日志格式：时间 | 级别 | 模块 | 消息
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(
    level: str = "INFO",
    log_file: str = None,
    to_console: bool = True,
) -> None:
    """
    初始化 IDC 资产管理日志。
    - level: 日志级别 DEBUG/INFO/WARNING/ERROR
    - log_file: 日志文件路径，默认 项目根目录/logs/idc_asset.log
    - to_console: 是否同时输出到控制台
    """
    if log_file is None:
        log_file = str(_log_file_path())

    log_level = getattr(logging, level.upper(), logging.INFO)
    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # 根 logger：app 及 uvicorn 等统一走这里
    root = logging.getLogger()
    root.setLevel(log_level)

    # 避免重复添加 handler（多次调用 setup_logging 时）
    for h in list(root.handlers):
        root.removeHandler(h)

    # 文件 handler：追加写入，便于按天或手动切割分析
    try:
        fh = logging.FileHandler(log_file, mode="a", encoding="utf-8")
        fh.setLevel(log_level)
        fh.setFormatter(formatter)
        root.addHandler(fh)
    except Exception as e:
        sys.stderr.write(f"[IDC日志] 无法创建日志文件 {log_file}: {e}\n")

    if to_console:
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(log_level)
        ch.setFormatter(formatter)
        root.addHandler(ch)

    # 应用 logger 使用同一配置
    app_logger = logging.getLogger("app")
    app_logger.setLevel(log_level)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # 访问日志可单独关掉，由中间件记录
    logging.getLogger("app").info("IDC资产管理日志已启用，文件: %s", log_file)


def get_logger(name: str = "app") -> logging.Logger:
    """获取带命名空间的 logger，便于按模块分析。"""
    return logging.getLogger(name)
