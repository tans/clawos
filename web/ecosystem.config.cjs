module.exports = {
  apps: [
    {
      name: "clawos",
      cwd: __dirname,
      script: "bun",
      args: "run src/index.ts",
      interpreter: "none",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "26222",
        UPLOAD_TOKEN: "clawos",
        MARKETPLACE_ENABLED: "1",
        ALIPAY_APP_ID: "2021006137647633",
        ALIPAY_GATEWAY: "https://openapi.alipay.com/gateway.do",
        ALIPAY_PRIVATE_KEY: "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDJC2A/l7rL5YnwlQNmMwbfoVaVPIR9eX3YpQ984UzJLYuMQm0lgLN5OiIcXiwIvKAoZcXW3JCyxGcbQFUuKabCErCkZ6Vp9rz4tmyIrVzB3ZbgdR2KQh1Vb3uRj4S9uopX85rYhorfi3G5yFa148tmmitoR/Q+IH+Ap9mMaQN8HK24xP+iWt9/O1ydlivmkKjs7t/cELJxEa7OiPpBn2soKTvk7KOmmwWnuSyBBpaUR7x2/4i/xqtiNAZs3VdazcIAkDIk0n2Jvif/erulhcg5KbN1Pxa0AWfJ7uvvzKV4+6ZrhlmztBOY7F0ExW3q/UjYGe2fauEU3FkrQ4GkW5+9AgMBAAECggEBALLVrLtExAQF3isk0o5Bi7a39KXx3EUlIj3prho+66f1HLIakK6QipWmkZs8Zd0rtSfaSB81un1a2gDSvDLBGDaAm6LTE8BrnHN9CpSV6fIFo+VsKGfJIgDSl0/HI6QF4HQWHULIg5YQm4xQWlmYFWHieAReJTRyghi2tn0BGPl3j4Banj+HeeEPf6A9OgZBuJm8he1c0Rxd3BudSqib5nn92GOTC3anxSt7+OmUWZ3Yc7OCwHaxAX5eTr4hC32TVVwrhXOc60eVU8CJHnJv14sfeJ69wUMb8cnkHiJMg1JlK89dfR0n0s0j1J0NBX/kfGJcj6Ye4+FkzFvUNgCKcaECgYEA+8AjTdhL/BfQn+VhTkdRHKJ1OybXQzCamBWr8WqSJ6qpnYied/eq7QiRCq33+Ytw+yKnEQ9px7kFklPorsy8CFCMuoCyPCHXDkvfDCy969Lkb3QpF1pY788Xq1V8M/NCwAsyXlCX1f8CNjqrihuHtRP9XUUaGKcMcWNhuvU44JUCgYEAzHAgmKF/MtThu/PFVYrJLlP/1rvy1V3P+tpRq7tKunbhIDoreYnDsko7j9nArzazjnTTehfphSQHdU2c35xFgOa/T8EZJF0sD1xU3M4iHZRukkdB4lijbYrc6ILn3bu7sR7cc/F47Hn00s+FiBSs1PFH4lKDpJ3ZnHwUwooxsIkCgYEAltqIjTIKPjJrEhVaXJTBlv4Gb36TyTBLwsxhrxUkJV7PqpVeGBcxtj3G4/ZhPIiBGAuovsFUqphFLWzYZj5KglT6LxvFMeE5Q9jU/C+nUrOZrOuXX+YEmxamYUWlWl/vZLKQ6RE0GshnI+W+OtDKXghvbz9kJteazis2OdiNz40CgYBSnKDfbKtM7C+H1vsQFTQ0z2bb7Dk1tWIc+Wn1XorVDMLuVfNJer0k59Bn0dOGOjGWyGjItq77yVJmOYXB6pE/hH8ciGhThH8Qefwk+ftZPqjr3XWnNLBdzLZ2EqgFtx4iddkZ1SNLVAD1yzwngEtTBWlJ8JQXyl2sWYu+DUAFGQKBgEjBeC/RkDp7PwtpVBnlGE1/LSzChchqo9LiPBaDe8FCF0B2VEclOpqtGZ2r8ci7Y8uSDdgTG6RpcAG4ayvA4JryE+06Fny0xPWw6Y3ZHPAEdSPWqJ/IZxnW0m2o9KhWZ+Ev0VW6RRQQMg25vEdh4IuuI5nY0RYO4WjCEMtqomlm",
        ALIPAY_PUBLIC_KEY: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3ng2V6Ro0QDXiLZPXM6ckWiv8icwaq1RAaBL74ZmUkxVPd1YiNGw9AgdpS28ekVHvUxNygvpUoLhPkMrYv2sLAHir2Bben1nISxWAdWxzUfXTQtviTEimdw3nPxfi1SpLREX2Gf6Uyxnx8JXBiI0h/QYXljE23Ug14CebPn2jSJI0NPIWkLgZHvo0H5tfwN1QLbIvHDJfUMaJgH64xfUYkusxupQb1L/GJlkdjis4VELa3L+769/aN5n9Jn6b7vGpfymnfljH5KorE5oNjomQ+STkUgddiA+nWpeVWyQabfYpUJkixhJW7X55OQB1tFLcw0FN9Xjhoo1gR6FewFeKwIDAQAB",
        ALIPAY_NOTIFY_URL: "https://geekclaw.ai/api/pay/alipay/notify",
      },
    },
  ],
};
