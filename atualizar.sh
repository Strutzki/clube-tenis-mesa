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

# ============================================================
# 🛡️ REDE DE SEGURANÇA — testa o app ANTES de publicar.
# Se o app tiver um erro que quebra o build, NADA é enviado e o
# site atual continua no ar, intacto. Evita publicar quebrado pra todos.
# ============================================================
echo "🧪 Testando o app antes de publicar..."

# ============================================================
# 🧪 A BATERIA — roda o motor de verdade (o admin-action que vai pro ar)
# contra um banco de mentira e confere os numeros que o regulamento manda.
# Se uma regra da competicao quebrar, para aqui e NADA e publicado.
# Detalhe em testes/README.md.
# ============================================================
if [ -d testes ]; then
    if ! npm run teste --silent; then
        echo ""
        echo "❌ A BATERIA DE TESTES FALHOU — alguma regra da competicao quebrou (veja acima)."
        echo "   🛡️  NADA foi publicado. O site atual continua no ar, intacto."
        echo ""
        read -p "Pressione Enter para fechar..."
        exit 1
    fi
    echo "✅ Bateria passou."
    echo ""
fi


if ! command -v npm >/dev/null 2>&1; then
    echo "❌ 'npm' não encontrado. Instale o Node.js (nodejs.org) e rode de novo."
    echo ""
    read -p "Pressione Enter para fechar..."
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "📥 Instalando dependências (só na 1ª vez, pode demorar um pouco)..."
    npm install || { echo "❌ Falha ao instalar dependências."; echo ""; read -p "Pressione Enter para fechar..."; exit 1; }
fi

if ! npm run build; then
    echo ""
    echo "❌ O TESTE FALHOU — tem um erro no app (veja as mensagens acima)."
    echo "   🛡️  NADA foi publicado. O site atual continua no ar, intacto."
    echo "   Corrija o erro e rode este atualizador de novo."
    echo ""
    read -p "Pressione Enter para fechar..."
    exit 1
fi

echo "✅ Teste passou — o app compila sem erros."
echo ""

# ============================================================
# 👀 O QUE VAI SUBIR — antes o script mandava TUDO que estivesse na
# pasta, sem mostrar. Agora ele lista e espera voce confirmar. Assim
# arquivo temporario ou teste esquecido nao viaja junto por acidente.
# ============================================================
echo "📦 Estes arquivos vao subir:"
echo ""
git status --short
echo ""
read -p "Confirma? (digite S para publicar, qualquer outra coisa cancela): " RESPOSTA
case "$RESPOSTA" in
    [Ss]) ;;
    *)
        echo ""
        echo "🚫 Cancelado. Nada foi publicado; o site atual continua no ar."
        echo ""
        read -p "Pressione Enter para fechar..."
        exit 0
        ;;
esac

echo ""
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
