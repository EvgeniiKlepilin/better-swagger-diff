# typed: false
# frozen_string_literal: true

# Formula is auto-updated by the release workflow.
# To release a new version, push a tag — CI regenerates this file with correct URLs and SHA256s.
class BetterSwaggerDiff < Formula
  desc "Compare Swagger/OpenAPI specs and detect breaking changes"
  homepage "https://github.com/better-swagger-diff/better-swagger-diff"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-darwin-arm64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end

    on_intel do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-darwin-x64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-linux-arm64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end

    on_intel do
      url "https://github.com/better-swagger-diff/better-swagger-diff/releases/download/v#{version}/bsd-linux-x64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  def install
    bin.install Dir["bsd-*"].first => "bsd"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bsd --version")
  end
end
