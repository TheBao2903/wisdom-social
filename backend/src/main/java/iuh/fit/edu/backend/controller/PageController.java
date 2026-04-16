package iuh.fit.edu.backend.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.constant.PageRole;
import iuh.fit.edu.backend.domain.entity.mysql.Page;
import iuh.fit.edu.backend.domain.entity.mysql.PagePost;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.domain.entity.nosql.Post;
import iuh.fit.edu.backend.dto.request.page.*;
import iuh.fit.edu.backend.dto.request.post.CreatePostRequest;
import iuh.fit.edu.backend.dto.response.ApiResponse;
import iuh.fit.edu.backend.service.page.PageMemberService;
import iuh.fit.edu.backend.service.page.PageService;
import iuh.fit.edu.backend.service.page.PagePostService;
import iuh.fit.edu.backend.service.post.PostService;
import iuh.fit.edu.backend.service.user.UserService;
import iuh.fit.edu.backend.service.s3.S3Service;
import iuh.fit.edu.backend.util.anotation.ApiMessage;
import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/page")
public class PageController {
    PageService pageService;
    PagePostService pagePostService;
    PageMemberService pageMemberService;
    UserService userService;
    S3Service s3Service;
    PostService postService;
    ObjectMapper objectMapper;

    public PageController(ObjectMapper objectMapper, PagePostService pagePostService,
                          PageService pageService, PostService postService,
                          S3Service s3Service, UserService userService,
                          PageMemberService pageMemberService) {
        this.objectMapper = objectMapper;
        this.pagePostService = pagePostService;
        this.pageService = pageService;
        this.postService = postService;
        this.s3Service = s3Service;
        this.userService = userService;
        this.pageMemberService = pageMemberService;
    }

    @PostMapping("/create")
    @ApiMessage("Create page successfully")
    public ResponseEntity<String> createPage(@RequestBody UserRequestCreatePage createPage){
        User currentUser = userService.getCurrentUser();
        if (currentUser == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not authenticated");
        Page page= pageService.createPage(currentUser.getId(),createPage);

        if (page!=null){

            UserRequestMemberPage userMemberPage=new UserRequestMemberPage(currentUser.getId(),page.getId(), PageRole.ADMIN);
            pageMemberService.addMemberPage(userMemberPage);

            UserRequestUpdatePage userRequestUpdatePage=new UserRequestUpdatePage();
            if (createPage.getAvatarUrl()!=null){
                String key=s3Service.moveUploadUrl("pages", page.getId(), createPage.getAvatarUrl());
                userRequestUpdatePage.setAvatarUrl(key);
            }
            if (createPage.getCoverUrl()!=null){
                String key=s3Service.moveUploadUrl("pages", page.getId(), createPage.getCoverUrl());
                userRequestUpdatePage.setCoverUrl(key);
            }
            if (userRequestUpdatePage.getAvatarUrl()!=null || userRequestUpdatePage.getCoverUrl()!=null){
                pageService.updatePage(page.getId(), userRequestUpdatePage);
            }
            return ResponseEntity.ok("Create page successfully");
        }

        return ResponseEntity.badRequest().body("Create page failed");
    }

    @PostMapping("/update/{pageId}")
    @ApiMessage("Update page successfully")
    public ResponseEntity<String> updatePage(@RequestBody UserRequestUpdatePage updatePage,@PathVariable long pageId){
        boolean success= pageService.updatePage(pageId,updatePage);
        if (success)
            return ResponseEntity.ok("Update page successfully");
        return ResponseEntity.badRequest().body("Update page failed");
    }

    @DeleteMapping("/delete/{id}")
    @ApiMessage("Delete page successfully")
    public ResponseEntity<String> deletePage(@PathVariable long id){
        boolean success= pageService.deletePage(id);
        if (success)
            return ResponseEntity.ok("Delete page successfully");
        return ResponseEntity.badRequest().body("Delete page failed");
    }

    @GetMapping("/{id}")
    @ApiMessage("Find page successfully")
    public ResponseEntity<Page> findPageById(@PathVariable long id){
        Page page=pageService.findPageById(id);
        if (page!=null)
            return ResponseEntity.ok(page);
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(null);
    }

    @GetMapping("/all")
    @ApiMessage("Get all pages successfully")
    public ResponseEntity<List<Page>> getAllPages(){
        List<Page> pages = pageService.findAllPages();
        return ResponseEntity.ok(pages);
    }

    @GetMapping("/my-pages")
    @ApiMessage("Get my pages successfully")
    public ResponseEntity<List<Page>> getMyPages(){
        User currentUser = userService.getCurrentUser();
        if (currentUser == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(null);
        List<Page> pages = pageService.findPagesByUserId(currentUser.getId());
        return ResponseEntity.ok(pages);
    }

    @PostMapping("/like")
    @ApiMessage("Like page successfully")
    public ResponseEntity<String> likePage(@RequestBody UserRequestPage requestPage) {
        boolean success= pageService.likePageUser(requestPage.getUserId(),requestPage.getPageId());
        if (success)
            return ResponseEntity.ok("Like page successfully");
        return ResponseEntity.badRequest().body("Like page failed");
    }

    @PostMapping("/follow")
    @ApiMessage("Follow page successfully")
    public ResponseEntity<String> followPage(@RequestBody UserRequestPage requestPage) {
        boolean success= pageService.followPageUser(requestPage.getUserId(),requestPage.getPageId());
        if (success)
            return ResponseEntity.ok("Follow page successfully");
        return ResponseEntity.badRequest().body("Follow page failed");
    }

    @PostMapping("/cancel-like")
    @ApiMessage("Cancel like page successfully")
    public ResponseEntity<String> cancelLikePage(@RequestBody UserRequestPage requestPage) {
        boolean success= pageService.cancelLikePageUser(requestPage.getUserId(),requestPage.getPageId());
        if (success)
            return ResponseEntity.ok("Cancel like page successfully");
        return ResponseEntity.badRequest().body("Cancel like page failed");
    }

    @PostMapping("/cancel-follow")
    @ApiMessage("Cancel follow page successfully")
    public ResponseEntity<String> cancelFollowPage(@RequestBody UserRequestPage requestPage) {
        boolean success= pageService.cancelFollowPageUser(requestPage.getUserId(),requestPage.getPageId());
        if (success)
            return ResponseEntity.ok("Cancel follow page successfully");
        return ResponseEntity.badRequest().body("Cancel follow page failed");
    }

    @GetMapping("/{pageId}/interaction-status")
    @ApiMessage("Get page interaction status")
    public ResponseEntity<Map<String, Object>> getPageInteractionStatus(@PathVariable long pageId) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(null);
        Map<String, Object> status = pageService.getPageInteractionStatus(currentUser.getId(), pageId);
        return ResponseEntity.ok(status);
    }

    @GetMapping("/update/upload-avatar")
    @ApiMessage("Upload image successfully")
    public ResponseEntity<String> updateUploadImage(@RequestParam String type,
                                                          @RequestParam long id,
                                                          @RequestParam String extension){
        Page page=pageService.findPageById(id);
        Map<String,String> image= s3Service.generateUpdateUploadUrl(type,id,extension);
        if (page!=null){
            UserRequestUpdatePage update=new UserRequestUpdatePage();
            update.setAvatarUrl(image.get("imageUrl"));
            pageService.updatePage(id,update);
        }
        return ResponseEntity.ok(image.get("uploadUrl"));
    }

    @GetMapping("/update/upload-cover")
    @ApiMessage("Upload cover image successfully")
    public ResponseEntity<String> updateUploadCoverImage(@RequestParam String type,
                                                         @RequestParam long id,
                                                         @RequestParam String extension){
        Page page=pageService.findPageById(id);
        Map<String,String> image= s3Service.generateUpdateUploadUrl(type,id,extension);
        if (page!=null){
            UserRequestUpdatePage update=new UserRequestUpdatePage();
            update.setCoverUrl(image.get("imageUrl"));
            pageService.updatePage(id,update);
        }
        return ResponseEntity.ok(image.get("uploadUrl"));
    }

    @GetMapping("/upload-avatar")
    @ApiMessage("Upload image successfully")
    public ResponseEntity<Map<String,String>> uploadImage(@RequestParam String type,
                                                          @RequestParam String extension){
        return ResponseEntity.ok(s3Service.generateUploadUrl(type,extension));
    }

    @PostMapping("/post/approve")
    @ApiMessage("Approve post successfully")
    public ResponseEntity<String> approvePostPage(@RequestBody UserRequestPagePost request) {
        boolean success = pagePostService.approvePostPage(
                request.getUserId(),
                request.getPageId(),
                new ObjectId(request.getPostId())
        );
        if (success)
            return ResponseEntity.ok("Approve post successfully");
        return ResponseEntity.badRequest().body("Approve post failed");
    }

    @PostMapping("/post/cancel-approve")
    @ApiMessage("Cancel approve post successfully")
    public ResponseEntity<String> cancelApprovePostPage(@RequestBody UserRequestPagePost request) {
        boolean success = pagePostService.cancelApprovePostPage(
                request.getUserId(),
                request.getPageId(),
                new ObjectId(request.getPostId())
        );
        if (success)
            return ResponseEntity.ok("Cancel approve post successfully");
        return ResponseEntity.badRequest().body("Cancel approve post failed");
    }

    @PostMapping(path = "/post/add",consumes = {"multipart/form-data"})
    @ApiMessage("Add post to page successfully")
    public ResponseEntity<String> addPostPage(@RequestParam("postData") String postDataJson,
                                              @RequestParam(value = "images", required = false) List<String> images,
                                               @RequestParam long pageId) throws JsonProcessingException {

        User user=userService.getCurrentUser();
        CreatePostRequest request = objectMapper.readValue(postDataJson, CreatePostRequest.class);
        Post post = postService.createPost(request, images, user.getId());

        boolean success = pagePostService.addPostPage(user.getId(), pageId, post);
        if (success)
            return ResponseEntity.ok("Add post to page successfully");
        return ResponseEntity.badRequest().body("Add post to page failed");
    }

    @GetMapping("/post/{postId}/{pageId}")
    @ApiMessage("get All post page successfully")
    public ResponseEntity<PagePost> getPagePostByIdandPostId(@PathVariable  ObjectId postId,
                                                @PathVariable  long pageId) {
        return ResponseEntity.ok(pagePostService.getPagePostByIdandPostId(pageId,postId));
    }

    @PostMapping("/post/remove")
    @ApiMessage("Remove post from page successfully")
    public ResponseEntity<String> removePostPage(@RequestBody UserRequestPagePost request) {
        boolean success = pagePostService.removePostPage(
                request.getUserId(),
                request.getPageId(),
                new ObjectId(request.getPostId())
        );
        if (success)
            return ResponseEntity.ok("Remove post from page successfully");
        return ResponseEntity.badRequest().body("Remove post from page failed");
    }

    @GetMapping("/post/all/{pageId}")
    @ApiMessage("Get all posts of page successfully")
    public ResponseEntity<ApiResponse<List<Post>>> getAllPostsOfPage(@PathVariable long pageId) {
        List<Post> posts = pagePostService.getAllPostOfPage(pageId);
        return ResponseEntity.ok(ApiResponse.success(200, "Get all posts of page successfully", posts));
    }

    @GetMapping("/post/waiting-approve/{pageId}")
    @ApiMessage("Get all posts waiting for approve successfully")
    public ResponseEntity<ApiResponse<List<Post>>> getAllPostsWaitingForApprove(@PathVariable long pageId) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error(401, "Unauthorized", null));
        List<Post> posts = pagePostService.getAllPostWaitingForApproveOfPage(currentUser.getId(), pageId);
        return ResponseEntity.ok(ApiResponse.success(200, "Get all posts waiting for approve successfully", posts));
    }

    @PostMapping("/post/approve-all")
    @ApiMessage("Approve all posts successfully")
    public ResponseEntity<String> approveAllPosts(@RequestBody UserRequestPage request) {
        boolean success = pagePostService.approveAllPostPage(request.getUserId(), request.getPageId());
        if (success)
            return ResponseEntity.ok("Approve all posts successfully");
        return ResponseEntity.badRequest().body("Approve all posts failed");
    }

    @PostMapping("/post/cancel-all")
    @ApiMessage("Cancel all posts successfully")
    public ResponseEntity<String> cancelAllPosts(@RequestBody UserRequestPage request) {
        boolean success = pagePostService.cancelAllPostPage(request.getUserId(), request.getPageId());
        if (success)
            return ResponseEntity.ok("Cancel all posts successfully");
        return ResponseEntity.badRequest().body("Cancel all posts failed");
    }
}
