# typed: false
# frozen_string_literal: true

# Formula is auto-updated by the release workflow.
# To release a new version, push a tag — CI regenerates this file with correct URLs and SHA256s.
class BetterSwaggerDiff < Formula
  desc "Compare Swagger/OpenAPI specs and detect breaking changes"
  homepage "https://github.com/better-swagger-diff/better-swagger-diff"
  version "0.1.0-test-7"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-darwin-arm64"
      sha256 "da3cced513456a94df2414d2a17d0180dc17a7964734f0c120e38e7eaaba815b"
    end

    on_intel do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-darwin-x64"
      sha256 "9a51c0ff4a98145c495bcefbe63b0684bd3802b0317ba4bb923b643445840373"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-linux-arm64"
      sha256 "9305ad84b1782d72c53b0466a61f78c1a2bb7ec59052d90d7a26d984f68fcc9c"
    end

    on_intel do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-linux-x64"
      sha256 "308362ea5f57c90fb85e065ca10a499f08a5936d4fb661e3ab119563a2a1f85e"
    end
  end

  def install
    bin.install Dir["bsd-*"].first => "bsd"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bsd --version")
  end
end
