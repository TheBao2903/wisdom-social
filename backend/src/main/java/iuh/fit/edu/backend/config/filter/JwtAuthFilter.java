package iuh.fit.edu.backend.config.filter;

import com.auth0.jwk.JwkException;
import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.UrlJwkProvider;
import iuh.fit.edu.backend.repository.mysql.BlackListUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    @Autowired
    BlackListUserRepository blackListUserRepository;

    private static final String JWKS_URL =
            "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_r9OwliPee";

    private static final String ISSUER =
            "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_r9OwliPee";

    @Value("$JWT}")
    private static String LOCAL_SECRET ;
    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String token = null;

        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("accessToken".equals(cookie.getName())) {
                    token = cookie.getValue();
                    break;
                }
            }
        }

        if (token != null) {
            try {
                DecodedJWT jwt;
                // Kiểm tra issuer để biết loại token
                DecodedJWT decoded = JWT.decode(token);
                String issuer = decoded.getIssuer();

                if ("wis-chat".equals(issuer)) {
                    jwt = verifyLocalToken(token);
                } else {
                    jwt = verifyCognitoToken(token);
                }

                boolean revoked = blackListUserRepository.existsByAnyToken(token);

                if (revoked) {
                    throw new RuntimeException("Token revoked");
                }

                String phone = jwt.getClaim("phone_number").asString();

                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(
                                phone, null, List.of()
                        );
                SecurityContextHolder.getContext().setAuthentication(auth);

            } catch (Exception e) {
                System.err.println("JWT validation failed: " + e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    public static DecodedJWT verifyLocalToken(String token) {
        JWTVerifier verifier = JWT
                .require(Algorithm.HMAC256(LOCAL_SECRET))
                .withIssuer("wis-chat")
                .build();

        return verifier.verify(token);
    }

    public static String generateToken(String phone) {
        return JWT.create()
                .withSubject(phone) // fallback
                .withClaim("phone_number", phone) // ✅ thêm cái này
                .withIssuer("wis-chat")
                .withIssuedAt(new Date())
                .withExpiresAt(new Date(System.currentTimeMillis() + 3600000)) // 1 hour
                .sign(Algorithm.HMAC256(LOCAL_SECRET));
    }

    public static String generateRefreshToken(String phone) {
        return JWT.create()
                .withSubject(phone)
                .withClaim("phone_number", phone)
                .withClaim("type", "refresh")
                .withIssuer("wis-chat")
                .withIssuedAt(new Date())
                .withExpiresAt(new Date(System.currentTimeMillis() + 604800000)) // 7 days
                .sign(Algorithm.HMAC256(LOCAL_SECRET));
    }

    private DecodedJWT verifyCognitoToken(String token) throws JwkException {
        DecodedJWT decodedJWT = JWT.decode(token);
        String keyId = decodedJWT.getKeyId();

        JwkProvider provider = new UrlJwkProvider(JWKS_URL);
        Jwk jwk = provider.get(keyId);
        RSAPublicKey publicKey = (RSAPublicKey) jwk.getPublicKey();

        JWTVerifier verifier = JWT
                .require(Algorithm.RSA256(publicKey, null))
                .withIssuer(ISSUER)
                .build();

        return verifier.verify(token);
    }
}

