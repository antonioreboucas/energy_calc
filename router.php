<?php
/**
 * Router pro servidor embutido do PHP (php -S host:porta router.php) —
 * também funciona sob Apache/XAMPP com o .htaccess ao lado (mesma pasta),
 * que reescreve toda URL sem arquivo/diretório correspondente pra cá.
 *
 * Só resolve uma URL sem extensão ("/dashboard") pro arquivo estático
 * correspondente ("dashboard.html") — não faz template nem lógica de
 * negócio nenhuma. O conteúdo servido é sempre o HTML exatamente como
 * está no disco, igual a qualquer outro arquivo estático deste projeto
 * (decisão de manter o PHP só como servidor de arquivo).
 */

// Caminho de onde ESTE router.php está sendo servido dentro do domínio —
// vazio se estiver na raiz (servidor embutido do PHP, "php -S host:porta
// router.php", onde __DIR__ e DOCUMENT_ROOT são a mesma pasta), ou algo
// como "/energycalc.com.br" se estiver hospedado numa subpasta dentro do
// Apache/XAMPP (funciona pra qualquer profundidade, não é hardcoded pra
// uma estrutura de htdocs específica).
//
// Comparar contra SCRIPT_NAME/PHP_SELF pareceria mais natural, mas o
// servidor embutido do PHP popula essas duas com o arquivo que ele decidiu
// tentar resolver pra URL pedida (às vezes nem existe relação com
// router.php — ex: numa URL sem extensão, SCRIPT_NAME apareceu como
// "/index.html"), não com router.php em si. __DIR__ (constante de
// compilação, sempre a pasta física deste arquivo) comparado a
// DOCUMENT_ROOT é o que realmente é estável nos dois ambientes.
$doc_root = str_replace('\\', '/', rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/\\'));
$script_dir = str_replace('\\', '/', __DIR__);
$base_path = str_starts_with($script_dir, $doc_root) ? substr($script_dir, strlen($doc_root)) : '';

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Tira o prefixo de subpasta (se houver) antes de qualquer resolução de
// rota abaixo — sem isso, servir de dentro de uma subpasta (Apache/XAMPP)
// faz TODA URL (extension-less, estáticos) parecer não-existente, já que
// REQUEST_URI vem com o caminho completo e o resto deste arquivo assume
// que $uri já é relativo à raiz do app (igual ao "php -S" serve
// nativamente, sem subpasta nenhuma).
if ($base_path !== '' && str_starts_with($uri, $base_path)) {
    $uri = substr($uri, strlen($base_path));
    if ($uri === '') $uri = '/';
}

$caminho = __DIR__ . $uri;

// Arquivo real existe (css/js/imagem/manifest/partial/etc.) — deixa o
// servidor embutido do PHP servir normalmente, sem passar por aqui.
if ($uri !== '/' && file_exists($caminho) && !is_dir($caminho)) {
    return false;
}

// Raiz -> landing page.
if ($uri === '/' || $uri === '') {
    readfile(__DIR__ . '/index.html');
    return true;
}

// "/rota" -> arquivo estático "rota.html", se existir.
$candidato = __DIR__ . rtrim($uri, '/') . '.html';
if (file_exists($candidato)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($candidato);
    return true;
}

http_response_code(404);
echo '404 - Página não encontrada';
return true;
