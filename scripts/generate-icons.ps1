# 선택한 원본을 아이콘 크기로 축소합니다. PNG를 Git에 포함하므로 CI에는 Windows가 필요하지 않습니다.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '../public/icons'
$sourcePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../assets/branding/moaboja-cat-v1.png'))
[IO.Directory]::CreateDirectory($iconRoot) | Out-Null
$sourceImage = [Drawing.Image]::FromFile($sourcePath)
try {
  foreach ($size in @(32,180,192,512)) {
    $icon = [Drawing.Bitmap]::new($size,$size)
    $graphics = [Drawing.Graphics]::FromImage($icon)
    try {
      $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#234e43'))
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($sourceImage,[Drawing.Rectangle]::new(0,0,$size,$size))
      $icon.Save((Join-Path $iconRoot "moaboja-cat-v1-$size.png"),[Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $icon.Dispose()
    }
  }
} finally {
  $sourceImage.Dispose()
}
Write-Output '모아보자 고양이 아이콘 32/180/192/512px 생성 완료'
