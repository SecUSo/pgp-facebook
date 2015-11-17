#!/usr/bin/perl -w

# fb-crawl.pl version 0.1.1

use strict;
use warnings;

$| = 1;
use utf8;
use open qw/:std :utf8/;


#use Getopt::Long;
#GetOptions(
#    "a" => \(my $dummy),
#    "u=s" => \(my $fb_user_email),
#    "p=s" => \(my $fb_user_pass),
#    "timeout=i" => \(my $timeout = 30),
#    "h" => \(my $help),
#    "https" => \(my $https),
#    "depth=i" => \(my $crawl_depth = 0),
#    "proxy=s" => \(my $proxy)
#);

my $fb_user_email = $ARGV[0];
my $fb_user_pass = $ARGV[1];
my ($https, $proxy);


# cleanup for notification process
  my $filename = '/home/.enigmail/keyDone/done.txt';
  unlink $filename or warn "Could not unlink $filename: $!";

  $filename = '/home/.enigmail/notStarted/notstarted.txt';
  unlink $filename or warn "Could not unlink $filename: $!";

  $filename = '/home/.enigmail/keyNotDone/NotDone.txt';
  unlink $filename or warn "Could not unlink $filename: $!";

  $filename = '/home/.enigmail/noofFriends.txt';
  unlink $filename or warn "Could not unlink $filename: $!";

my $deletedir = '/home/.enigmail/key/';
system("rm -rf ".$deletedir);

system('mkdir '.$deletedir);

#print "Result: $res\n";

print "directories handled\n\n\n";

#usage() if defined($help); #|| !defined($fb_user_email);

#sub usage {
#	print "usage: ./fb-crawl.pl -u email\@address -i -w -f\n";
#	print "  -u         email address\n";
#	print "  -p         password\n";
#	print "  -https     use ssl encryption\n";
#	print "  -proxy     host[:port]\n";
#	print "  -timeout   timeout in seconds (default: $timeout)\n";
#	print "  -depth     crawl depth (default: 0)\n";
#	print "              0 - only your friends\n";
#	print "              1 - friends of friends\n";
#	print "              2 - friends of friends of friends\n";
#	print "              3 - friendception\n";
#	print "  -h         help\n";
#    exit();
#}

sub die_report {
	die($_[0]."! Please report errors to https://code.google.com/p/fb-crawl/issues/\n");
}


use strict;
use warnings;
use Time::HiRes qw(usleep);
use Fcntl;
use HTML::Entities;
use File::Fetch;
use WWW::Curl::Easy;
use File::Path qw(make_path );
use URI::Escape;
use POSIX qw/strftime/;
use LWP::Simple;
use HTML::Parser;
use HTTP::Status qw(:constants :is status_message);
use Net::Ping;
use File::Fetch;
use LWP::UserAgent;
if (defined($https)) {
    use LWP::Protocol::https;
}


# trims whitespaces from ends of string
sub trim($) {
	my $string = shift;
	$string =~ s/^\s+//;
	$string =~ s/\s+$//;
	return $string;
}


#
# Initiate LWP::UserAgent
#

use HTTP::Cookies;

my $Start = time();

my $ua = LWP::UserAgent->new;
$ua->cookie_jar( HTTP::Cookies->new(
    'file' => '/home/cookies.lwp',
        # where to read/write cookies
    'autosave' => 1,
        # save it to disk when done
  ));
$ua->agent('Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0'); #
$ua->default_header('Accept-Language' => "en,en-us;q=0.5");
#$ua->timeout($timeout);
$ua->max_redirect(5);
$ua->default_header('Accept' => 'text/plain, text/html, application/pgp, application/pdf, message/partial,  message/external-body, application/postscript, x-be2,  application/andrew-inset, text/richtext, text/enriched, x-sun-attachment');
if (defined($https)) {
	$ua->ssl_opts(verify_hostnames => 0);
}

my $response;
# Checks the -proxy and prints the apparent IP Address
if (defined($proxy)) {
	$ua->proxy(['http'], 'http://'.$proxy.'/');
	$response = $ua->get('http://ip.appspot.com/');
	if ($response->is_success) {
		print '+ IP Address: '.$response->decoded_content;
	}else{
		print "! Error: Can't connect to proxy at $proxy\n";
		exit;
	}
}


  print "Email given: ";
  print $fb_user_email."\n";
  #print "Password given:";
  #print $fb_user_pass."\n";
  #print $ARGV[2];
  #print $ARGV[3];

#
# Request Facebook password if -p not set
#
if (!defined($fb_user_pass)) {

	print '? Facebook User EMail: ';
	system('stty','-echo');
	chomp($fb_user_email=<STDIN>);
	system('stty','echo');
	print "\n";

	print '? Facebook Password: ';
	system('stty','-echo');
	chomp($fb_user_pass=<STDIN>);
	system('stty','echo');
	print "\n";
}


#
# Log in to Facebook
#
$response = $ua->get('http://www.facebook.com/')->decoded_content;

if (index($response, 'login') > -1) {
	print "+ Logging in...";
	push @{ $ua->requests_redirectable }, 'POST';
	$response = $ua->post('http'.(defined($https)?'s':'').'://www.facebook.com/login.php?login_attempt=1', { email => $fb_user_email, pass => $fb_user_pass });
	$response = $response->decoded_content;
	print "done\n";
}else{
	print "+ Using previous session cookies\n";
}

#
# Parse User ID
#
#my $fb_user_id = $1 if $response =~ /envFlush\(\{"user"\:"([0-9]+)"/;
my $fb_user_id = "12345678";

#
# Parse User Name
#
my $istart = index($response, '<span class="headerTinymanName"');
$istart = index($response, '<a class="fbxWelcomeBoxName"') if ($istart < 0);
$istart = index($response, '>', $istart)+1;
my $iend = index($response, '</', $istart);
my $fb_user_name = substr($response, $istart, $iend-$istart);



        print "Find friends of ".$fb_user_name."\n";

$response = http_request('https://m.facebook.com/'); #<a class="ba bd" href="/david.kay.98?r

# changing html at facebook
$istart = index($response, '<a class="ba bb" href="/');
  #$istart = index($response, '<a class="_2dpe _1ayn" href="https://www.facebook.com/');
        if ($istart < 0) {
			    $response =~ /"errorSummary":"([\"]+)"/;
          $istart = index($response, '<a class="bc bb" href="/');
          if ($istart < 0) {
            $istart = index($response, '<a class="bd be" href="/');
            if ($istart < 0) {
              $istart = index($response, '<a class="bc bd" href="/');
              if ($istart < 0) {
                my $filename = '/home/.enigmail/response.html';
                open(my $fh, '>', $filename) or die "Could not open file '$filename' $!";
                print $fh $response;
                close $fh;
                print "new format: see response.html\n";
              }
            }
          }
		    }
        if (index($response, 'No results found.') > -1) {
			    print "! Error: Couldn't get friends.\n";
			    #last;
        }
        $istart = $istart+24; # + Length of indexing string
        $iend = index($response, '?', $istart);
        my $html = substr($response, $istart, $iend-$istart); # sebmoos?fref=fr_tab">Sebastian Moos<

        $fb_user_name = $html;
        print "Find friends of ".$fb_user_name."\n";

        #number of friends
        $response = http_request('https://m.facebook.com/'.$fb_user_name.'?v=friends'); #<h3 class="bw j">Freunde (501)</h3>
        $istart = index($response, 'Friends (');
        if ($istart < 0) {
          $istart = index($response, 'Freunde (');
          if ($istart < 0) {
            my $filename = '/home/.enigmail/responseFriendsNumber.html';
            open(my $fha, '>', $filename) or die "Could not open file '$filename' $!";
            print $fha $response;
            close $fha;
            print "new format: see responseFriendsNumber.html\n";
          }
        }
        $istart = $istart+9; # + Length of indexing string
        $iend = index($response, ')<', $istart);
        print $istart;
        print $iend;
        print "\n\n\n";
        my $html = substr($response, $istart, $iend-$istart); # sebmoos?fref=fr_tab">Sebastian Moos<
        if ($html eq '') {
            #last;
        }

        print "Number of friends ".$html."\n";
        my $filename = '/home/.enigmail/noofFriends.txt';
          open(my $fhb, '>', $filename) or die "Could not open file '$filename' $!";
          print $fhb $html;
          close $fhb;

        find_friends($fb_user_name);


#
# Check for any login issues
#
if (index($response, 'login_error_box') > -1) {
    my $error = $1 if $response =~ /login_error_box[^>]+>(.*?)<\/div>/;
    $error =~ s|</h2>|: |g;
    $error =~ s|<.+?>| |g;
    $error =~ s/\s+/\ /g;
    $error = trim($error);
    print "! Error: $error\n";
    exit;
}







#
# $ua->get with added functionality to detect Facebook errors
#
sub http_request {
    my $tries = 0;
    my $success = 0;
	if (defined($https)) {
		$_[0] =~ s/http:/https:/;
	}
    while (!$success && $tries < 2) {
        $response = $ua->get($_[0]);
        $success = $response->is_success;
        $tries++;
    }
    $response = $response->decoded_content;
	if (index($response, '<title>Content Not Found</title>') > -1 or index($response, '<title>Page Not Found</title>') > -1) {
		$response = 'Page Not Found.';
		$success = 0;
	}
	if (index($response, '<h1>Sorry, something went wrong.</h1>') > -1) {
		$response = 'Sorry, something went wrong.';
	}
	if (index($response, '<div id="error"') > -1) {
		my $error = $1 if $response =~ /<div id="error">(.*?)<\/div>/;
		$error =~ s|</h2>|: |g;
		$error =~ s|<.+?>| |g;
		$error =~ s/\s+/\ /g;
		$error = trim($error);
		print $error."\n";
		#self_destruct();
	}
	if (index($response, 'login') > -1) {
		print "! Error: you're not logged in\n";


            my $filename = '/home/.enigmail/login.html';
            open(my $fhr, '>', $filename) or die "Could not open file '$filename' $!";
            print $fhr $response;
            close $fhr;
            #print "done saving html\n";
              print 'new format: see login.html';


  my $filena = '/home/.enigmail/keyNotDone/NotDone.txt';
  open(my $fhrr, '>', $filena) or die "Could not open file '$filename' $!";
  print $fhrr "no";
  close $fhrr;
  exit 0;

		#self_destruct();
	}
    if ($success) {
		 return $response;
    }else{
        print '! Request Failed: '.$_[0].' - '.$response."\n";
        return 0;
    }
}



#
# Gets all the user's friends and sends them to the crawl_user() thread
# parameters: current name - facebook user
sub find_friends {
    my ($current_name, $html);

    $current_name = $_[0];
    print "+ Loading ".$current_name." friends \n";

    my $friends_found = 0;
	my @user_friends;

  #my $i = 0;

    my $filename = 'names.txt';
    open(my $fh, '>', $filename) or die "Could not open file '$filename' $!";
    for (my $start = 0; 1; $start = $start+24) { # https://m.facebook.com/$current_name?v=friends&startindex=200 #
        if ($istart < 0) {
			    $response =~ /"errorSummary":"([\"]+)"/;
			    print "Error: $1\n" if defined($1);
			    last;
		    }
        my $response = http_request('https://m.facebook.com/'.$current_name.'?v=friends&startindex='.$start);


# changing html at facebook
        $iend = 0;
        for(my $x = 0; $x<24; $x++){
          $istart = index($response, '<a class="ca" href="/',$iend);
        if ($istart < 0) {
          $istart = index($response, '<a class="bo" href="/',$iend); ##sometimes ca, sometimes bo
          if ($istart < 0) {
            $istart = index($response, '<a class="cb" href="/',$iend); ##sometimes ca, sometimes bo
            if ($istart < 0) {
              $istart = index($response, '<a class="bp" href="/',$iend); ##sometimes ca, sometimes bo
              if ($istart < 0) {
                $istart = index($response, '<a class="cc" href="/',$iend); ##sometimes ca, sometimes bo 
                if ($istart < 0) {
                  $istart = index($response, '<a class="cd" href="/',$iend); ##sometimes ca, sometimes bo 
                  if ($istart < 0) {
                    my $filename = '/home/.enigmail/responsefriends.html';
                    open(my $fhr, '>', $filename) or die "Could not open file '$filename' $!";
                    print $fhr $response;
                    close $fhr;
                    print 'new format: see responsefriends.html';
                  }
                }            
              }
            }
          }
        }
        if ($istart < 0) {
			    $response =~ /"errorSummary":"([\"]+)"/;
			    print "Error: $1\n" if defined($1);
			    last;
		    }
        if (index($response, 'No results found.') > -1) {
			    print "! Error: Couldn't get friends.\n";
			    last;
        }
        $istart = $istart+21;

        ############### find id
        $iend = index($response, 'fref', $istart);
        $html = substr($response, $istart, $iend-$istart-1); 
        #print "\n\n\n\n$html\n\n\n\n";
        if ($html eq '') {
          print 'html empty';
            last;
        }
       #print $i++."\n";
        my $id = $html;

        # in case of profile.php facebook profiles
      my $t = substr($response, $istart, 11); #profile.php?id=1233454534&amp
      if ($t eq 'profile.php'){ # use regex to find id
        $html =~ /\d+/;
        $id = $&;
      }


        ##################### find name

        $istart = index($response, 'fref=fr_tab">',$iend);

        my $komm = 0;
        if ($istart == -1){
          $istart = index($response, 'fref=fr_tab',$iend);
          $komm = 1;
        }

        $istart = $istart + 13;
        $iend = index($response, '</a>', $istart);
        $html = substr($response, $istart, $iend-$istart); 

        if ($komm == 1){
          $istart = index($html, '">');
          $istart = $istart + 2;
          $html = substr($html, $istart);
        }
        my $name = $html;

        if ($id eq $_[0] || $id eq $fb_user_id) {
                next;
        }
        $name = decode_entities($name);
        # save names and ids to file
        print $fh "$id:$name\n";
        $friends_found++;
            }
        }

    close $fh;
    print "done finding friends: $friends_found friends found!\n";

    downloadKeys();
}

##
## download Keys of all friends found before
##
sub downloadKeys {

  my $file = 'names.txt';
  open my $info, $file or die "Could not open $file: $!";


  while( my $line = <$info>)  {
    my ($id, $name) = split /[:]/, $line;


    my $dir = '/home/.enigmail/key/';
    my $url = 'https://www.facebook.com/'.$id.'/publickey/download';

    my $curl = WWW::Curl::Easy->new;

    $curl->setopt(WWW::Curl::Easy::CURLOPT_HEADER(), 1);
    $ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.16 (KHTML, like Gecko) Chrome/24.0.1304.0 Safari/537.16';
    $curl->setopt(WWW::Curl::Easy::CURLOPT_USERAGENT(), $ua);
    $curl->setopt(WWW::Curl::Easy::CURLOPT_URL(), $url);
    $curl->setopt(WWW::Curl::Easy::CURLOPT_HTTPHEADER(), ['Content-Type: application/asc', 'Content-Encoding: gzip']);

    # A filehandle, reference to a scalar or reference to a typeglob can be used here.
    my $response_body;
    $curl->setopt(CURLOPT_WRITEDATA,\$response_body);

    # Starts the actual request
    my $retcode = $curl->perform;

    # Looking at the results...
    if ($retcode == 0) {
      my $response_code = $curl->getinfo(CURLINFO_HTTP_CODE);
      # judge result and next action based on $response_code
      if ($response_code != 404) {
        chomp($name);
        eval { make_path($dir) };
        if ($@) {
          print "Couldn't create $dir: $@";
        }
        my $filename = $dir.$name.'.asc';
        open(my $fhr, '>', $filename) or die "could not open file '$filename' $!";
        my $ind = index($response_body,"-----BEGIN PGP PUBLIC KEY BLOCK-----");
        my $key = substr($response_body, $ind);
        print $fhr $key;
        close $fhr;
        print "done saving key: $name\n";
      }
    } 
    else 
    {
      # Error code, type of error, error message
      print("An error happened: $retcode ".$curl->strerror($retcode)." ".$curl->errbuf."\n");
    }
  }

  print "\n\n FINITO \n\n";
  close $info;


  my $filena = '/home/.enigmail/notStarted/notstarted.txt';
  open(my $fhrr, '>', $filena) or die "Could not open file '$filename' $!";
  print $fhrr "no";
  close $fhrr;

  my $End = time();
  my $Diff = $End - $Start;

  print "Time needed:  ".$Diff."\n";
  my $filename = '/home/.enigmail/keyDone/done.txt';
  open(my $done, '>', $filename) or die "Could not open file '$filename' $!";
  print $done "yes";
  close $done;
}
