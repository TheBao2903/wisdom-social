package iuh.fit.edu.backend.common.config;

import io.github.cdimascio.dotenv.Dotenv;

public class DotenvConfig {
    public static void load() {
        // Load file .env

        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMissing()
                .load();

//        // Helper method để set property: ưu tiên system env, fallback về .env file
//        setPropertyFromEnv(dotenv, "SPRING_DATASOURCE_USERNAME");
//        setPropertyFromEnv(dotenv, "SPRING_DATASOURCE_PASSWORD");

        // AWS
        setPropertyFromEnv(dotenv, "AWS_ACCESS_KEY");
        setPropertyFromEnv(dotenv, "AWS_SECRET_KEY");
        setPropertyFromEnv(dotenv, "AWS_REGION");

//        // Cognito
//        setPropertyFromEnv(dotenv, "COGNITO_USER_POOL_ID");
//        setPropertyFromEnv(dotenv, "COGNITO_CLIENT_ID");
//        setPropertyFromEnv(dotenv, "COGNITO_CLIENT_SECRET");

//        // VNPay
//        setPropertyFromEnv(dotenv, "TMN_CODE");
//        setPropertyFromEnv(dotenv, "HASH_SECRET");
//        setPropertyFromEnv(dotenv, "VNPAY_URL");
//        setPropertyFromEnv(dotenv, "VNPAY_RETURN_URL");

//        // Email
//        setPropertyFromEnv(dotenv, "EMAIL_USERNAME");
//        setPropertyFromEnv(dotenv, "EMAIL_PASSWORD");
    }

    private static void setPropertyFromEnv(Dotenv dotenv, String key) {
        // Ưu tiên: System environment variable > .env file
        String value = System.getenv(key);
        if (value == null && dotenv != null) {
            value = dotenv.get(key);
        }
        if (value != null) {
            System.setProperty(key, value);
        }
    }
}