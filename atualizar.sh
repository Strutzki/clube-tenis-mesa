#!/bin/bash

# ============================================================
# CLUBE DO TÊNIS DE MESA — Script de Atualização
# ============================================================

PASTA="$HOME/clube-tenis-mesa-v2"

echo "🏓 Clube do Tênis de Mesa — Atualizador"
echo "========================================"

cd "$PASTA" || { echo "❌ Pasta não encontrada!"; read -p "Pressione Enter para fechar..."; exit 1; }

echo "📁 Pasta: $PASTA"
echo ""

if git diff --quiet && git diff --cached --quiet; then
    echo "⚠️  Nenhuma alteração detectada."
    echo "   Substitua o App.jsx na pasta src/ antes de rodar este script."
    echo ""
    read -p "Pressione Enter para fechar..."
    exit 0
fi

echo "📦 Preparando arquivos..."
git add .

echo "💾 Salvando alterações..."
git commit -m "atualização $(date '+%d/%m/%Y %H:%M')"

echo "🚀 Enviando para o GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Atualização enviada com sucesso!"
    echo "   O site será atualizado em cerca de 1 minuto."
    echo ""
    echo "🌐 https://clube-tenis-mesa.vercel.app"
else
    echo ""
    echo "❌ Erro ao enviar. Verifique sua conexão e tente novamente."
fi

echo ""
read -p "Pressione Enter para fechar..."
