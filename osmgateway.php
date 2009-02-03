<?php
// PHP Proxy example for Yahoo! Web services. 
// define ('HOSTNAME', 'http://search.yahooapis.com/');

define ('HOSTNAME', 'http://api.openstreetmap.org/api/0.5/map?');

$path = key($_GET).'='.current($_GET);
$url = HOSTNAME.$path;

$session = curl_init($url);

// Don't return HTTP headers. Do return the contents of the call
curl_setopt($session, CURLOPT_HEADER, false);
curl_setopt($session, CURLOPT_FOLLOWLOCATION, true); 
curl_setopt($session, CURLOPT_RETURNTRANSFER, true);

$xml = curl_exec($session);
$xml = trim($xml);
header("Content-Type: text/xml");  // indicate xml is returned

//echo htmlspecialchars($xml); special chars come through but
echo $xml;
curl_close($session);
?>
