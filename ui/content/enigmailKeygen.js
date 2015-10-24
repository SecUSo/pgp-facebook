/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@enigmail.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

// Uses: chrome://enigmail/content/enigmailCommon.js
Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/keyManagement.jsm");

try {
  Components.utils.import("resource://gre/modules/Promise.jsm");
} catch (ex) {
  Components.utils.import("resource://gre/modules/commonjs/sdk/core/promise.js");
}

const Ec = EnigmailCommon;

// Initialize enigmailCommon
EnigInitCommon("enigmailKeygen");
//EnigInitCommon("enigmailKeyManager");


const Cc = Components.classes;
const Ci = Components.interfaces;

var gAccountManager = Components.classes[ENIG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);

var gUserIdentityList;
var gUserIdentityListPopup;
var gUseForSigning;

var gKeygenRequest;
var gAllData = "";
var gGeneratedKey= null;
var gUsedId;


var LastKey= null;


const KEYGEN_CANCELLED = "cancelled";
const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

function enigmailKeygenLoad() {
  DEBUG_LOG("enigmailKeygen.js: Load\n");

  gUserIdentityList      = document.getElementById("userIdentity");
  gUserIdentityListPopup = document.getElementById("userIdentityPopup");
  gUseForSigning     = document.getElementById("useForSigning");

  var noPassphrase = document.getElementById("noPassphrase");

  if (! Ec.getGpgFeature("keygen-passphrase")) {
    document.getElementById("passphraseRow").setAttribute("collapsed", "true");
    noPassphrase.setAttribute("collapsed", "true");
  }

  if (gUserIdentityListPopup) {
    fillIdentityListPopup();
  }
  gUserIdentityList.focus();

  // restore safe setting, which you ALWAYS explicitly have to overrule,
  // if you don't want them:
  // - specify passphrase
  // - specify expiry date
  noPassphrase.checked = false;
  EnigSetPref("noPassphrase", noPassphrase.checked);
  var noExpiry = document.getElementById("noExpiry");
  noExpiry.checked = false;

  enigmailKeygenUpdate(true, false);

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
     EnigAlert(EnigGetString("accessError"));
  }

  if (enigmailSvc.agentType != "gpg") {
     EnigAlert(EnigGetString("onlyGPG"));
     return;
  }
}

function enigmailOnClose() {
  var closeWin = true;
  if (gKeygenRequest) {
    closeWin = EnigConfirm(EnigGetString("keyAbort"), EnigGetString("keyMan.button.generateKeyAbort"), EnigGetString("keyMan.button.generateKeyContinue"));
  }
  if (closeWin) abortKeyGeneration();
  return closeWin;
}

function enigmailKeygenUnload() {
   DEBUG_LOG("enigmailKeygen.js: Unload\n");

   enigmailKeygenCloseRequest();
}


function enigmailKeygenUpdate(getPrefs, setPrefs) {
  DEBUG_LOG("enigmailKeygen.js: Update: "+getPrefs+", "+setPrefs+"\n");

  var noPassphrase        = document.getElementById("noPassphrase");
  var noPassphraseChecked = getPrefs ? EnigGetPref("noPassphrase")
                                     : noPassphrase.checked;

  if (setPrefs) {
    EnigSetPref("noPassphrase", noPassphraseChecked);
  }

  noPassphrase.checked = noPassphraseChecked;

  var passphrase1 = document.getElementById("passphrase");
  var passphrase2 = document.getElementById("passphraseRepeat");
  passphrase1.disabled = noPassphraseChecked;
  passphrase2.disabled = noPassphraseChecked;
}

function enigmailKeygenTerminate(exitCode) {
  DEBUG_LOG("enigmailKeygen.js: Terminate:\n");

  var curId = gUsedId;

  gKeygenRequest = null;

  if ((! gGeneratedKey) || gGeneratedKey == KEYGEN_CANCELLED) {
    if (! gGeneratedKey)
      EnigAlert(EnigGetString("keyGenFailed"));
    return;
  }


  LastKey = "0x"+gGeneratedKey.substr(-8,8);

  var progMeter = document.getElementById("keygenProgress");
  progMeter.setAttribute("value", 100);

  if (gGeneratedKey) {
     if (gUseForSigning.checked) {
        curId.setBoolAttribute("enablePgp", true);
        curId.setIntAttribute("pgpKeyMode", 1);
        curId.setCharAttribute("pgpkeyId", "0x"+gGeneratedKey.substr(-8,8));

        enigmailKeygenUpdate(false, true);

        EnigSavePrefs();

        if (EnigConfirm(EnigGetString("keygenComplete", curId.email)+"\n\n"+EnigGetString("revokeCertRecommended"), EnigGetString("keyMan.button.generateCert"))) {
            EnigCreateRevokeCert(gGeneratedKey, curId.email, closeAndReset);
        }
        else
          closeAndReset();
     }
     else {
       if (EnigConfirm(EnigGetString("genCompleteNoSign")+"\n\n"+EnigGetString("revokeCertRecommended"), EnigGetString("keyMan.button.generateCert"))) {
          EnigCreateRevokeCert(gGeneratedKey, curId.email, closeAndReset);
          genAndSaveRevCert(gGeneratedKey, curId.email).then(
            function _resolve() {
              closeAndReset();
            },
            function _reject() {
              closeAndReset();
              // do nothing
            }
          );
       }
       else
          closeAndReset();
     }
   }
   else {
      EnigAlert(EnigGetString("keyGenFailed"));
      window.close();
   }
}

/**
 * generate and save a revokation certificate.
 *
 * return: Promise object
 */

function genAndSaveRevCert(keyId, uid) {
  DEBUG_LOG("enigmailKeygen.js: genAndSaveRevCert\n");

  return new Promise(
    function(resolve, reject) {

    let keyIdShort = "0x"+keyId.substr(-16, 16);
    let keyFile = EnigmailCore.getProfileDirectory();
    keyFile.append(keyIdShort + "_rev.asc");

    // create a revokation cert in the TB profile directoy
    EnigmailKeyMgmt.genRevokeCert(window, "0x"+keyId, keyFile, "1", "",
      function _revokeCertCb(exitCode, errorMsg) {
        if (exitCode != 0) {
          EnigAlert(EnigGetString("revokeCertFailed")+"\n\n"+errorMsg);
          reject(1);
        }
        saveRevCert(keyFile, keyId, uid, resolve, reject);
      });
    }
  );
}

/**
 *  create a copy of the revokation cert at a user defined location
 */
function saveRevCert(inputKeyFile, keyId, uid, resolve, reject) {

  let defaultFileName = uid.replace(/[\\\/\<\>]/g, "");
  defaultFileName += " (0x"+keyId.substr(-8,8)+") rev.asc";

  let outFile = EnigFilePicker(EnigGetString("saveRevokeCertAs"),
                       "", true, "*.asc",
                       defaultFileName,
                       [EnigGetString("asciiArmorFile"), "*.asc"]);

  if (outFile) {
    try {
      inputKeyFile.copyToFollowingLinks(outFile.parent, outFile.leafName);
      EnigAlert(EnigGetString("revokeCertOK"));
    }
    catch (ex) {
      EnigAlert(EnigGetString("revokeCertFailed"));
      reject(2);
    }
  }
  resolve();
}


/**
* Copy key to clipboard, show instructions where to save key in profile
*/
function KeyToFacebook() {

  enigmailCopyToClipbrd(true);

  EnigAlert("Es wird empfohlen den Public Key in Ihrem Facebook Profil zu veröffentlichen. Dazu gehen Sie bitte wie folgt vor:\n\n Öffnen Sie ihr Facebook Profil, navigieren Sie zu 'Info' und dann 'Kontaktinformationen'. Dort klicken Sie auf 'Füge einen öffentlichen Schlüssel hinzu'. Fügen Sie anschließend den Key per Tastenkombination 'Strg + V' ein.");
}

/**
* Copy generated key to clipboard
*/

function enigmailCopyToClipbrd(fb) {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc)
    return;

  if(fb)
  {
    var exitCodeObj={};
    var errorMsgObj={};
    var keyData = enigmailSvc.extractKey(window, 0, LastKey, null, exitCodeObj, errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigAlert(EnigGetString("copyToClipbrdFailed")+"\n\n"+errorMsgObj.value);
      return;
    }
    var clipBoard = Cc[ENIG_CLIPBOARD_CONTRACTID].getService(Ci.nsIClipboard);
    try {
      clipBoardHlp = Cc[ENIG_CLIPBOARD_HELPER_CONTRACTID].getService(Ci.nsIClipboardHelper);
      clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kGlobalClipboard);
      if (clipBoard.supportsSelectionClipboard()) {
        clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kSelectionClipboard);
      }
      DEBUG_LOG("enigmailKeyManager.js: enigmailImportFromClipbrd: got data from clipboard");
    }
    catch(ex) {
      EnigAlert(EnigGetString("copyToClipbrdFailed"));
    }
  }
  else
  {
  var keyList = enigmailGetSelectedKeys();
  if (keyList.length==0) {
    EnigAlert(EnigGetString("noKeySelected"));
    return;
  }
  var exitCodeObj={};
  var errorMsgObj={};
  var keyData = enigmailSvc.extractKey(window, 0, "0x"+keyList.join(" 0x"), null, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value != 0) {
    EnigAlert(EnigGetString("copyToClipbrdFailed")+"\n\n"+errorMsgObj.value);
    return;
  }
  var clipBoard = Cc[ENIG_CLIPBOARD_CONTRACTID].getService(Ci.nsIClipboard);
  try {
    clipBoardHlp = Cc[ENIG_CLIPBOARD_HELPER_CONTRACTID].getService(Ci.nsIClipboardHelper);
    clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kGlobalClipboard);
    if (clipBoard.supportsSelectionClipboard()) {
      clipBoardHlp.copyStringToClipboard(keyData, clipBoard.kSelectionClipboard);
    }
    DEBUG_LOG("enigmailKeyManager.js: enigmailImportFromClipbrd: got data from clipboard");
    EnigAlert(EnigGetString("copyToClipbrdOK"));
  }
  catch(ex) {
    EnigAlert(EnigGetString("copyToClipbrdFailed"));
  }
}

}


function closeAndReset() {
  KeyToFacebook();
  var enigmailSvc = GetEnigmailSvc();
  enigmailSvc.invalidateUserIdList();
  window.close();
}


// Cleanup
function enigmailKeygenCloseRequest() {
   DEBUG_LOG("enigmailKeygen.js: CloseRequest\n");

  if (gKeygenRequest) {
    var p = gKeygenRequest;
    gKeygenRequest = null;
    p.kill(false);
  }
}

function enigmailCheckPassphrase() {
  var passphraseElement = document.getElementById("passphrase");
  var passphrase2Element = document.getElementById("passphraseRepeat");

  var passphrase = passphraseElement.value;

  if (passphrase != passphrase2Element.value) {
    EnigAlert(EnigGetString("passNoMatch"));
    return null;
  }

  if (passphrase.search(/[^\x20-\x7E]/)>=0) {
    if (! Ec.confirmDlg(window, Ec.getString("keygen.passCharProblem"),
        Ec.getString("dlg.button.ignore"), Ec.getString("dlg.button.cancel"))) {
      return null;
    }
  }
  if ((passphrase.search(/^\s/)==0) || (passphrase.search(/\s$/)>=0)) {
    EnigAlert(EnigGetString("passSpaceProblem"));
    return null;
  }
  return passphrase;
}



function enigmailKeygenStart() {
   DEBUG_LOG("enigmailKeygen.js: Start\n");


   if (gKeygenRequest) {
      let req = gKeygenRequest.QueryInterface(Components.interfaces.nsIRequest);
      if (req.isPending()) {
         EnigAlert(EnigGetString("genGoing"));
         return;
      }
   }

   gGeneratedKey = null;
   gAllData = "";

   var enigmailSvc = GetEnigmailSvc();
   if (!enigmailSvc) {
      EnigAlert(EnigGetString("accessError"));
      return;
   }


   // gpg >= 2.1 queries passphrase using gpg-agent only
   if (Ec.getGpgFeature("keygen-passphrase")) {
     var passphrase = enigmailCheckPassphrase();
     if (passphrase == null) return;

     var noPassphraseElement = document.getElementById("noPassphrase");

     if (!passphrase && !noPassphraseElement.checked) {
        EnigAlert(EnigGetString("passCheckBox"));
        return;
     }
   }
   else {
     passphrase = "";
   }

   var commentElement = document.getElementById("keyComment");
   var comment = commentElement.value;

   var noExpiry = document.getElementById("noExpiry");
   var expireInput = document.getElementById("expireInput");
   var timeScale = document.getElementById("timeScale");

   var expiryTime = 0;
   if (! noExpiry.checked) {
      expiryTime = Number(expireInput.value) * Number(timeScale.value);
      if (expiryTime > 36500) {
        EnigAlert(EnigGetString("expiryTooLong"));
        return;
      }
      if (! (expiryTime > 0)) {
        EnigAlert(EnigGetString("expiryTooShort"));
        return;
      }
   }
   var keySize = Number(document.getElementById("keySize").value);
   var keyType = Number(document.getElementById("keyType").value);

   if ((keyType==KEYTYPE_DSA) && (keySize>3072)){
     EnigAlert(EnigGetString("dsaSizeLimit"));
     keySize = 3072;
   }

   var curId = getCurrentIdentity();
   gUsedId = curId;

   var userName = curId.fullName;
   var userEmail = curId.email;

   if (!userName) {
      EnigAlert(EnigGetString("passUserName"));
      return;
   }

   var idString = userName;

   if (comment)
      idString += " (" + comment + ")";

   idString += " <" + userEmail + ">";

   var confirmMsg = EnigGetString("keyConfirm", idString);

   if (!EnigConfirm(confirmMsg, EnigGetString("keyMan.button.generateKey"))) {
     return;
   }

   var proc = null;

   var listener = {
      onStartRequest: function () {},
      onStopRequest: function(status) {
        enigmailKeygenTerminate(status);
      },
      onDataAvailable: function(data) {
        DEBUG_LOG("enigmailKeygen.js: onDataAvailable() "+data+"\n");

        gAllData += data;
        var keyCreatedIndex = gAllData.indexOf("[GNUPG:] KEY_CREATED");
        if (keyCreatedIndex >0) {
          gGeneratedKey = gAllData.substr(keyCreatedIndex);
          gGeneratedKey = gGeneratedKey.replace(/(.*\[GNUPG:\] KEY_CREATED . )([a-fA-F0-9]+)([\n\r].*)*/, "$2");
          gAllData = gAllData.replace(/\[GNUPG:\] KEY_CREATED . [a-fA-F0-9]+[\n\r]/, "");
        }
        gAllData = gAllData.replace(/[\r\n]*\[GNUPG:\] GOOD_PASSPHRASE/g, "").replace(/([\r\n]*\[GNUPG:\] PROGRESS primegen )(.)( \d+ \d+)/g, "$2");
        var progMeter = document.getElementById("keygenProgress");
        var progValue = Number(progMeter.value);
        progValue += (1+(100-progValue)/200);
        if (progValue >= 95) progValue=10;
        progMeter.setAttribute("value", progValue);
      }
   };

   try {
      gKeygenRequest = Ec.generateKey(window,
                         Ec.convertFromUnicode(userName),
                         Ec.convertFromUnicode(comment),
                         Ec.convertFromUnicode(userEmail),
                         expiryTime,
                         keySize,
                         keyType,
                         Ec.convertFromUnicode(passphrase),
                         listener);
   } catch (ex) {
      Ec.DEBUG_LOG("enigmailKeygen.js: generateKey() failed with "+ex.toString()+"\n"+ex.stack+"\n");
   }

   if (!gKeygenRequest) {
      EnigAlert(EnigGetString("keyGenFailed"));
   }

   WRITE_LOG("enigmailKeygen.js: Start: gKeygenRequest = "+gKeygenRequest+"\n");
}

function abortKeyGeneration() {
  gGeneratedKey = KEYGEN_CANCELLED;
  enigmailKeygenCloseRequest();
}

function enigmailKeygenCancel() {
  DEBUG_LOG("enigmailKeygen.js: Cancel\n");
  var closeWin=false;

  if (gKeygenRequest) {
    closeWin = EnigConfirm(EnigGetString("keyAbort"), EnigGetString("keyMan.button.generateKeyAbort"), EnigGetString("keyMan.button.generateKeyContinue"));
    if (closeWin) abortKeyGeneration();
  }
  else {
    closeWin=true;
  }

  if (closeWin) window.close();
}

function onNoExpiry() {
  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");

  expireInput.disabled=noExpiry.checked;
  timeScale.disabled=noExpiry.checked;
}


function queryISupArray(supportsArray, iid) {
  var result = [];
  var i;
  // Gecko > 20
  for (i=0; i<supportsArray.length; i++) {
    result.push(supportsArray.queryElementAt(i, iid));
  }

  return result;
}

function getCurrentIdentity()
{
  var item = gUserIdentityList.selectedItem;
  var identityKey = item.getAttribute('id');

  var identity = gAccountManager.getIdentity(identityKey);

  return identity;
}

function fillIdentityListPopup()
{
  DEBUG_LOG("enigmailKeygen.js: fillIdentityListPopup\n");

  var idSupports = gAccountManager.allIdentities;
  var identities = queryISupArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);

  DEBUG_LOG("enigmailKeygen.js: fillIdentityListPopup: "+identities + "\n");

  // Default identity
  var defIdentity;
  var defIdentities = gAccountManager.defaultAccount.identities;
  try {
    // Gecko >= 20
    if (defIdentities.length >= 1) {
      defIdentity = defIdentities.queryElementAt(0, Components.interfaces.nsIMsgIdentity);
    } else {
      defIdentity = identities[0];
    }
  }
  catch (ex) {
    // Gecko < 20
    if (defIdentities.Count() >= 1) {
      defIdentity = defIdentities.QueryElementAt(0, Components.interfaces.nsIMsgIdentity);
    } else {
      defIdentity = identities[0];
    }
  }

  DEBUG_LOG("enigmailKeygen.js: fillIdentityListPopup: default="+defIdentity.key+"\n");

  var selected = false;
  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];

    DEBUG_LOG("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;

    var serverSupports, inServer;
    try {
      // Gecko >= 20
      serverSupports = gAccountManager.getServersForIdentity(identity);
      if (serverSupports.length > 0) {
        inServer = serverSupports.queryElementAt(0, Components.interfaces.nsIMsgIncomingServer);
      }
    }
    catch (ex) {
      // Gecko < 20
      serverSupports = gAccountManager.GetServersForIdentity(identity);
      if (serverSupports.GetElementAt(0)) {
        inServer = serverSupports.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
      }
    }

    if (inServer) {
      var accountName = " - "+inServer.prettyName;

      DEBUG_LOG("enigmailKeygen.js: accountName="+accountName+"\n");
      DEBUG_LOG("enigmailKeygen.js: email="+identity.email+"\n");

      var item = document.createElement('menuitem');
//      item.setAttribute('label', identity.identityName);
      item.setAttribute('label', identity.identityName + accountName);
      item.setAttribute('class', 'identity-popup-item');
      item.setAttribute('accountname', accountName);
      item.setAttribute('id', identity.key);
      item.setAttribute('email', identity.email);

      gUserIdentityListPopup.appendChild(item);

      if (!selected)
        gUserIdentityList.selectedItem = item;

      if (identity.key == defIdentity.key) {
        gUserIdentityList.selectedItem = item;
        selected = true;
      }
    }
  }

}