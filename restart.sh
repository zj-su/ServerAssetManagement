#!/bin/bash

# IDC资产管理系统 - 重启脚本
# 用法: ./restart.sh [backend|frontend|all]

PROJECT_DIR="/root/idc资产管理/IDC项目"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 重启后端
restart_backend() {
    echo -e "${YELLOW}[后端] 正在停止...${NC}"
    pkill -9 -f "uvicorn app.main:app" 2>/dev/null
    sleep 2
    
    echo -e "${YELLOW}[后端] 正在启动...${NC}"
    cd "$BACKEND_DIR"
    nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
    
    sleep 3
    if pgrep -f "uvicorn app.main:app" > /dev/null; then
        echo -e "${GREEN}[后端] 启动成功! 端口: 8000${NC}"
    else
        echo -e "${RED}[后端] 启动失败! 查看日志: /tmp/backend.log${NC}"
        return 1
    fi
}

# 重启前端
restart_frontend() {
    echo -e "${YELLOW}[前端] 正在停止...${NC}"
    pkill -9 -f "node.*$FRONTEND_DIR" 2>/dev/null
    sleep 2
    
    echo -e "${YELLOW}[前端] 正在启动...${NC}"
    cd "$FRONTEND_DIR"
    nohup npm run start > /tmp/frontend.log 2>&1 &
    
    sleep 5
    if pgrep -f "node.*$FRONTEND_DIR" > /dev/null || netstat -tlpn 2>/dev/null | grep -q ":3001"; then
        echo -e "${GREEN}[前端] 启动成功! 端口: 3001${NC}"
    else
        echo -e "${RED}[前端] 启动失败! 查看日志: /tmp/frontend.log${NC}"
        return 1
    fi
}

# 显示状态
show_status() {
    echo ""
    echo -e "${YELLOW}========== 服务状态 ==========${NC}"
    
    if pgrep -f "uvicorn app.main:app" > /dev/null; then
        echo -e "[后端] ${GREEN}运行中${NC} (端口 8000)"
    else
        echo -e "[后端] ${RED}已停止${NC}"
    fi
    
    if netstat -tlpn 2>/dev/null | grep -q ":3001"; then
        echo -e "[前端] ${GREEN}运行中${NC} (端口 3001)"
    else
        echo -e "[前端] ${RED}已停止${NC}"
    fi
    echo -e "${YELLOW}==============================${NC}"
}

# 主逻辑
case "${1:-all}" in
    backend|b)
        restart_backend
        ;;
    frontend|f)
        restart_frontend
        ;;
    status|s)
        show_status
        ;;
    all|a|"")
        restart_backend
        echo ""
        restart_frontend
        show_status
        ;;
    *)
        echo "用法: $0 [backend|frontend|all|status]"
        echo "  backend  (b) - 仅重启后端"
        echo "  frontend (f) - 仅重启前端"
        echo "  all      (a) - 重启全部 (默认)"
        echo "  status   (s) - 查看服务状态"
        exit 1
        ;;
esac
