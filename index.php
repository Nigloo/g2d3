<?php
    if (!function_exists('http_response_code')) {
        function http_response_code($code = NULL) {
            if ($code !== NULL) {
                switch ($code) {
                    case 100: $text = 'Continue'; break;
                    case 101: $text = 'Switching Protocols'; break;
                    case 200: $text = 'OK'; break;
                    case 201: $text = 'Created'; break;
                    case 202: $text = 'Accepted'; break;
                    case 203: $text = 'Non-Authoritative Information'; break;
                    case 204: $text = 'No Content'; break;
                    case 205: $text = 'Reset Content'; break;
                    case 206: $text = 'Partial Content'; break;
                    case 300: $text = 'Multiple Choices'; break;
                    case 301: $text = 'Moved Permanently'; break;
                    case 302: $text = 'Moved Temporarily'; break;
                    case 303: $text = 'See Other'; break;
                    case 304: $text = 'Not Modified'; break;
                    case 305: $text = 'Use Proxy'; break;
                    case 400: $text = 'Bad Request'; break;
                    case 401: $text = 'Unauthorized'; break;
                    case 402: $text = 'Payment Required'; break;
                    case 403: $text = 'Forbidden'; break;
                    case 404: $text = 'Not Found'; break;
                    case 405: $text = 'Method Not Allowed'; break;
                    case 406: $text = 'Not Acceptable'; break;
                    case 407: $text = 'Proxy Authentication Required'; break;
                    case 408: $text = 'Request Time-out'; break;
                    case 409: $text = 'Conflict'; break;
                    case 410: $text = 'Gone'; break;
                    case 411: $text = 'Length Required'; break;
                    case 412: $text = 'Precondition Failed'; break;
                    case 413: $text = 'Request Entity Too Large'; break;
                    case 414: $text = 'Request-URI Too Large'; break;
                    case 415: $text = 'Unsupported Media Type'; break;
                    case 500: $text = 'Internal Server Error'; break;
                    case 501: $text = 'Not Implemented'; break;
                    case 502: $text = 'Bad Gateway'; break;
                    case 503: $text = 'Service Unavailable'; break;
                    case 504: $text = 'Gateway Time-out'; break;
                    case 505: $text = 'HTTP Version not supported'; break;
                    default:
                        exit('Unknown http status code "' . htmlentities($code) . '"');
                    break;
                }
                $protocol = (isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.0');
                header($protocol . ' ' . $code . ' ' . $text);
                $GLOBALS['http_response_code'] = $code;
            } else {
                $code = (isset($GLOBALS['http_response_code']) ? $GLOBALS['http_response_code'] : 200);
            }
            return $code;
        }
    }


    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Headers: Content-Type");
    header("Content-type: text/csv");
    
    $host = $_POST['host'];
    $database = $_POST['dbname'];
    $user = $_POST['user'];
    $pwd = $_POST['pwd'];
    $request = $_POST['request'];
    
    try {
        $db = new PDO('mysql:host=' . $host . ';dbname=' . $database, $user, $pwd, array());
    
        // Connecting to database
        $stmt = $db->prepare($request, array(PDO::ATTR_CURSOR, PDO::CURSOR_SCROLL));
        $stmt->execute();
        
        if(!$row = $stmt->fetch(PDO::FETCH_BOTH, PDO::FETCH_ORI_NEXT)) {
            http_response_code(500);
            die('SQL request has returned nothing');
        }

        // Header
        $first_column = true;
        while (list($key, $value) = each($row)) {
            if(!is_int($key)) {
                if($first_column) {
                    echo $key;
                    $first_column = false;
                }
                else {
                    echo ',' . $key;
                }
            }
        }
        echo "\n";
        
        // Values
        do {
            for($i = 0 ; $i < $stmt->columnCount() ; $i++) {
                if($i == 0) {
                    echo $row[0];
                }
                else {
                    echo ',' . $row[$i];
                }
            }
            echo "\n";
        } while($row = $stmt->fetch(PDO::FETCH_NUM, PDO::FETCH_ORI_NEXT));
        
    }
    catch (Exception $e) {
        http_response_code(500);
        die($e->getMessage());
    }
    
?>
