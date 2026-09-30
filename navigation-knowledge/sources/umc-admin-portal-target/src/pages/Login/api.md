# Azure AD Login

## GET /api/AzureAD/GetAzureADLoginURL

The Azure AD redirect route is controlled by `VITE_AZURE_AD_CALLBACK_PATH`.
Default value:

```env
VITE_AZURE_AD_CALLBACK_PATH=/auth/microsoft/callback
```

Response:

```json
{
  "isSuccess": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "url": "https://login.microsoftonline.com/dc93dc2b-c380-4e75-9791-9223eb984f21/oauth2/v2.0/authorize?client_id=5dc7c401-d43d-472e-b6d3-9efb8b8a6935&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fauth%2Fmicrosoft%2Fcallback&response_mode=query&scope=openid%20profile%20email%20User.Read&code_challenge=F5IqfuMUq03KwdQJXnmWDSOjx7o-ZUHBXFlSN91y3pM&code_challenge_method=S256&state=2glhOWdXYPO2Xd-PXPwRuGzmVVCix-S-lY-Dk4RJPI4"
  }
}
```

Redirect example:

```text
/auth/microsoft/callback?code=xxx&state=yyy
```

## POST /api/AzureAD/CallBackGetTokenByCode

Request:

```json
{
  "code": "xxx",
  "state": "yyy"
}
```

Response:

```json
{
  "isSuccess": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "access_token": "string",
    "token_type": "string",
    "expires_in": 0,
    "scope": "string",
    "id_token": "string"
  }
}
```

## GET /api/AzureAD/GetUserInfo

Request:

```json
{
  "accessToken": "xxx"
}
```

Response:

```json
{
  "isSuccess": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "id": "string",
    "displayName": "string",
    "givenName": "string",
    "surname": "string",
    "mail": "string",
    "userPrincipalName": "string"
  }
}
```

## GET /api/AzureAD/GetUserInfoToLogin

Request:

```json
{
  "accessToken": "xxx"
}
```

Response:

```json
{
  "isSuccess": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "id": "string",
    "token": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phoneNumber": "string",
    "isActive": true,
    "isFirstLogin": true,
    "isChangePwd": true,
    "createOn": "2026-03-10T06:17:22.245Z",
    "lastLoginTime": "2026-03-10T06:17:22.245Z",
    "userInvitation": {
      "userProfileId": "string",
      "userTypeId": "string",
      "id": 0,
      "name": "string",
      "photoUrl": "string",
      "email": "string"
    },
    "userEstablishments": [
      {
        "userProfileId": "string",
        "id": 0,
        "userTypeId": "string",
        "nameEn": "string",
        "nameAr": "string",
        "email": "string",
        "establishmentUrl": "string"
      }
    ],
    "listRoles": [
      {
        "id": "string",
        "name": "string",
        "discriminator": "string",
        "isShown": true,
        "nameEn": "string",
        "nameAr": "string",
        "descEn": "string",
        "descAr": "string",
        "departmentId": 0,
        "status": "string",
        "createAt": "2026-03-10T06:17:22.245Z",
        "users": [
          {
            "id": "string",
            "firstName": "string",
            "lastName": "string",
            "isActive": true,
            "lastLoginDate": "2026-03-10T06:17:22.245Z",
            "createdOn": "2026-03-10T06:17:22.245Z",
            "email": "string",
            "emailConfirmed": true,
            "passwordHash": "string",
            "securityStamp": "string",
            "phoneNumber": "string",
            "phoneNumberConfirmed": true,
            "twoFactorEnabled": true,
            "lockoutEndDateUtc": "2026-03-10T06:17:22.245Z",
            "lockoutEnabled": true,
            "accessFailedCount": 0,
            "userName": "string",
            "smartpassPersonId": 0,
            "crmid": "string",
            "crmpasswordHash": "string",
            "managerId": "string",
            "isUMCUser": true,
            "status": "string",
            "adminUserLinked": "string",
            "accountNo": "string",
            "reason": "string",
            "isChangePwd": true,
            "userLogins": [
              {
                "id": 0,
                "loginProvider": "string",
                "providerKey": "string",
                "userId": "string",
                "impersonatedByUserId": "string",
                "smartpassPersonId": 0,
                "createdOn": "2026-03-10T06:17:22.245Z",
                "loginType": 0,
                "loginMethod": 0,
                "user": "string"
              }
            ],
            "roles": ["string"],
            "userProfiles": [
              {
                "id": 0,
                "userId": "string",
                "userTypeId": 0,
                "personId": 0,
                "governmentTypeId": 0,
                "entityName": "string",
                "addressId": 0,
                "mediaFileNumber": "string",
                "officialLetterUrl": "string",
                "defaultLanguageId": 0,
                "createdOn": "2026-03-10T06:17:22.245Z",
                "isCompleted": true,
                "groupId": 0,
                "isApproved": true,
                "status": "string",
                "user": "string",
                "updateOn": "2026-03-10T06:17:22.245Z",
                "profileCode": "string",
                "rejectReason": "string",
                "isVip": true,
                "isActive": true,
                "reason": "string",
                "establishment": {
                  "id": 0,
                  "nameAr": "string",
                  "nameEn": "string",
                  "authorityId": 0,
                  "licenseNumber": "string",
                  "parentId": 0,
                  "licenseCopyUrl": "string",
                  "tenancyContractEndDate": "2026-03-10T06:17:22.245Z",
                  "tenancyContractCopyUrl": "string",
                  "addressId": 0,
                  "deletedOn": "2026-03-10T06:17:22.245Z",
                  "circulationAudienceFigure": 0,
                  "establishmentTypeId": 0,
                  "hasValidLicense": true,
                  "foreignAddressId": 0,
                  "nationalityId": 0,
                  "memorandumOfAssociationCopyUrl": "string",
                  "powerOfAttorneyCopyUrl": "string",
                  "statementCopyUrl": "string",
                  "createdBy": "string",
                  "trnumber": "string",
                  "frequencyUrl": "string",
                  "licenseExpiryDate": "2026-03-10T06:17:22.245Z",
                  "emails": "string",
                  "phoneNumber": "string",
                  "officialLetterUrl": "string"
                },
                "userType": {
                  "id": 0,
                  "nameEn": "string",
                  "nameAr": "string",
                  "code": "string",
                  "isShown": true,
                  "descAr": "string",
                  "descEn": "string"
                },
                "isIndividual": true
              }
            ],
            "userDepartments": [
              {
                "id": 0,
                "userId": "string",
                "departmentId": 0,
                "isMaster": true,
                "isLeader": true
              }
            ]
          }
        ],
        "menus": [
          {
            "id": 0,
            "nameAr": "string",
            "nameEn": "string",
            "parentId": 0,
            "logo": "string",
            "url": "string",
            "order": 0,
            "showInOldPortal": true,
            "showInNewPortal": true,
            "newParentId": 0,
            "child": ["string"],
            "parent": "string"
          }
        ]
      }
    ],
    "rolesInfo": [
      {
        "roleID": "string",
        "roleName": "string"
      }
    ],
    "listUserProfile": [
      {
        "id": 0,
        "userId": "string",
        "userTypeId": 0,
        "userType": {
          "id": 0,
          "nameEn": "string",
          "nameAr": "string",
          "code": "string",
          "isShown": true,
          "descAr": "string",
          "descEn": "string"
        },
        "personId": 0,
        "governmentTypeId": 0,
        "entityName": "string",
        "addressId": 0,
        "mediaFileNumber": "string",
        "officialLetterUrl": "string",
        "defaultLanguageId": 0,
        "createdOn": "2026-03-10T06:17:22.245Z",
        "isCompleted": true,
        "groupId": 0,
        "isApproved": true,
        "status": "string",
        "statusInfo": {
          "code": "string",
          "scope": "string",
          "nameEn": "string",
          "nameAr": "string"
        }
      }
    ],
    "listUserType": [
      {
        "id": 0,
        "nameEn": "string",
        "nameAr": "string",
        "code": "string",
        "isShown": true,
        "descAr": "string",
        "descEn": "string"
      }
    ],
    "establishments": [
      {
        "id": 0,
        "nameAr": "string",
        "nameEn": "string",
        "authorityId": 0,
        "licenseNumber": "string",
        "parentId": 0,
        "licenseCopyUrl": "string",
        "tenancyContractEndDate": "2026-03-10T06:17:22.245Z",
        "tenancyContractCopyUrl": "string",
        "addressId": 0,
        "deletedOn": "2026-03-10T06:17:22.245Z",
        "circulationAudienceFigure": 0,
        "establishmentTypeId": 0,
        "hasValidLicense": true,
        "foreignAddressId": 0,
        "nationalityId": 0,
        "memorandumOfAssociationCopyUrl": "string",
        "powerOfAttorneyCopyUrl": "string",
        "statementCopyUrl": "string",
        "createdBy": "string",
        "trnumber": "string",
        "frequencyUrl": "string",
        "licenseExpiryDate": "2026-03-10T06:17:22.245Z",
        "emails": "string",
        "phoneNumber": "string",
        "officialLetterUrl": "string"
      }
    ],
    "persons": [
      {
        "id": 0,
        "name": "string",
        "nationalityId": 0,
        "emiratesId": "string",
        "passportNumber": "string",
        "emiratesIdCopyUrl": "string",
        "passportCopyUrl": "string",
        "genderId": 0,
        "dateOfBirth": "2026-03-10T06:17:22.245Z",
        "photoUrl": "string",
        "createdOn": "2026-03-10T06:17:22.245Z",
        "title": "string",
        "acquitanceFormUrl": "string",
        "iqamaUrl": "string",
        "isSmartpass": true,
        "academicQualificationUrl": "string",
        "previousJob": "string",
        "twitterAccount": "string",
        "nameAr": "string",
        "titleAr": "string",
        "tradeLicenseNo": "string",
        "tradeLicenseEndDate": "2026-03-10T06:17:22.245Z",
        "authorityId": 0,
        "tradeLicenseCopyUrl": "string",
        "trnumber": "string",
        "details": "string",
        "emiratesIdexpiryDate": "2026-03-10T06:17:22.245Z",
        "passportExpiryDate": "2026-03-10T06:17:22.245Z",
        "isIcp": true,
        "icpData": "string",
        "goodConductUrl": "string",
        "ageProofUrl": "string",
        "agreementContractUrl": "string",
        "isTrained": true,
        "managerDetails": "string",
        "guardianDetails": "string",
        "personalEmail": "string",
        "personalMobile": "string",
        "occupation": "string",
        "idType": "string",
        "visaCopyUrl": "string",
        "visaExpiryDate": "2026-03-10T06:17:22.245Z",
        "uid": "string"
      }
    ]
  }
}
```
