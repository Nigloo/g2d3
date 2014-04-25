<?php
    header("Access-Control-Allow-Origin: http://localhost:8000");
    header("Access-Control-Allow-Headers: Content-Type");
    
    $host = $_POST['host'];
    $database = $_POST['dbname'];
    $user = $_POST['user'];
    $pwd = $_POST['pwd'];
    $request = $_POST['request'];
    
    $db = new PDO('mysql:host=' . $host . ';dbname=' . $database, $user, $pwd, array());
    
    try {
        // Connecting to database
        $stmt = $db->prepare($request, array(PDO::ATTR_CURSOR, PDO::CURSOR_SCROLL));
        $stmt->execute();
        
        if(!$row = $stmt->fetch(PDO::FETCH_BOTH, PDO::FETCH_ORI_NEXT)) {
            //http_response_code(204);
            die('SQL request has returned nothing');
        }
        
        header("Content-type: text/csv");
        
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
    catch (PDOException $e) {
        die($e->getMessage());
    }
    
?>
